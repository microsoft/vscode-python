// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// Refer to A/B testing wiki for more details: https://en.wikipedia.org/wiki/A/B_testing

'use strict';

import { inject, injectable, named, optional } from 'inversify';
import { parse } from 'jsonc-parser';
import * as path from 'path';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { IApplicationEnvironment } from '../application/types';
import { EXTENSION_ROOT_DIR, STANDARD_OUTPUT_CHANNEL } from '../constants';
import { traceDecorators, traceError } from '../logger';
import { IFileSystem } from '../platform/types';
import {
    ABExperiments,
    IConfigurationService,
    ICryptoUtils,
    IExperimentsManager,
    IHttpClient,
    IOutputChannel,
    IPersistentState,
    IPersistentStateFactory,
    IPythonSettings
} from '../types';
import { sleep } from '../utils/async';
import { swallowExceptions } from '../utils/decorators';
import { Experiments } from '../utils/localize';
import { NativeNotebook } from './groups';

const EXPIRY_DURATION_MS = 30 * 60 * 1000;
export const isDownloadedStorageValidKey = 'IS_EXPERIMENTS_STORAGE_VALID_KEY';
export const experimentStorageKey = 'EXPERIMENT_STORAGE_KEY';
export const downloadedExperimentStorageKey = 'DOWNLOADED_EXPERIMENTS_STORAGE_KEY';
/**
 * Local experiments config file. We have this to ensure that experiments are used in the first session itself,
 * as about 40% of the users never come back for the second session.
 */
const configFile = path.join(EXTENSION_ROOT_DIR, 'experiments.json');
export const configUri = 'https://raw.githubusercontent.com/microsoft/vscode-python/master/experiments.json';
export const EXPERIMENTS_EFFORT_TIMEOUT_MS = 2000;
// The old experiments which are working fine using the `SHA512` algorithm
export const oldExperimentSalts = ['ShowExtensionSurveyPrompt', 'ShowPlayIcon', 'AlwaysDisplayTestExplorer', 'LS'];

/**
 * Manages and stores experiments, implements the AB testing functionality
 */
@injectable()
export class ExperimentsManager implements IExperimentsManager {
    /**
     * Keeps track of the list of experiments user is in
     */
    public userExperiments: ABExperiments = [];
    /**
     * Experiments user requested to opt into manually
     */
    public _experimentsOptedInto: string[] = [];
    /**
     * Experiments user requested to opt out from manually
     */
    public _experimentsOptedOutFrom: string[] = [];
    /**
     * Returns `true` if experiments are enabled, else `false`.
     */
    public _enabled: boolean = true;
    /**
     * Keeps track of the experiments to be used in the current session
     */
    private experimentStorage: IPersistentState<ABExperiments | undefined>;
    /**
     * Keeps track of the downloaded experiments in the current session, to be used in the next startup
     * Note experiments downloaded in the current session has to be distinguished
     * from the experiments download in the previous session (experimentsStorage contains that), reason being the following
     *
     * THE REASON TO WHY WE NEED TWO STATE STORES USED TO STORE EXPERIMENTS:
     * We do not intend to change experiments mid-session. To implement this, we should make sure that we do not replace
     * the experiments used in the current session by the newly downloaded experiments. That's why we have a separate
     * storage(downloadedExperimentsStorage) to store experiments downloaded in the current session.
     * Function updateExperimentStorage() makes sure these are used in the next session.
     */
    private downloadedExperimentsStorage: IPersistentState<ABExperiments | undefined>;
    /**
     * Keeps track if the storage needs updating or not.
     * Note this has to be separate from the actual storage as
     * download storages by itself should not have an Expiry (so that it can be used in the next session even when download fails in the current session)
     */
    private isDownloadedStorageValid: IPersistentState<boolean>;
    private activatedOnce: boolean = false;
    private settings!: IPythonSettings;
    constructor(
        @inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory,
        @inject(IHttpClient) private readonly httpClient: IHttpClient,
        @inject(ICryptoUtils) private readonly crypto: ICryptoUtils,
        @inject(IApplicationEnvironment) private readonly appEnvironment: IApplicationEnvironment,
        @inject(IOutputChannel) @named(STANDARD_OUTPUT_CHANNEL) private readonly output: IOutputChannel,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(IConfigurationService) private readonly configurationService: IConfigurationService,
        @optional() private experimentEffortTimeout: number = EXPERIMENTS_EFFORT_TIMEOUT_MS
    ) {
        this.isDownloadedStorageValid = this.persistentStateFactory.createGlobalPersistentState<boolean>(
            isDownloadedStorageValidKey,
            false,
            EXPIRY_DURATION_MS
        );
        this.experimentStorage = this.persistentStateFactory.createGlobalPersistentState<ABExperiments | undefined>(
            experimentStorageKey,
            undefined
        );
        this.downloadedExperimentsStorage = this.persistentStateFactory.createGlobalPersistentState<
            ABExperiments | undefined
        >(downloadedExperimentStorageKey, undefined);
    }

    @swallowExceptions('Failed to activate experiments')
    public async activate(): Promise<void> {
        if (this.activatedOnce) {
            return;
        }
        this.activatedOnce = true;
        this.settings = this.configurationService.getSettings(undefined);
        this._experimentsOptedInto = this.settings.experiments.optInto;
        this._experimentsOptedOutFrom = this.settings.experiments.optOutFrom;
        this._enabled = this.settings.experiments.enabled;
        if (!this._enabled) {
            sendTelemetryEvent(EventName.PYTHON_EXPERIMENTS_DISABLED);
            return;
        }
        await this.updateExperimentStorage();
        this.populateUserExperiments();
        for (const exp of this.userExperiments || []) {
            // We need to know whether an experiment influences the logs we observe in github issues, so log the experiment group
            this.output.appendLine(Experiments.inGroup().format(exp.name));
        }
        this.initializeInBackground().ignoreErrors();
    }

    @traceDecorators.error('Failed to identify if user is in experiment')
    public inExperiment(experimentName: string): boolean {
        if (!this._enabled) {
            return false;
        }
        this.sendTelemetryIfInExperiment(experimentName);
        return this.userExperiments.find((exp) => exp.name === experimentName) ? true : false;
    }

    /**
     * Populates list of experiments user is in
     */
    @traceDecorators.error('Failed to populate user experiments')
    public populateUserExperiments(): void {
        this.cleanUpExperimentsOptList();
        if (Array.isArray(this.experimentStorage.value)) {
            const remainingExpriments: ABExperiments = [];
            // First process experiments in order of user preference (if they have opted out or opted in).
            for (const experiment of this.experimentStorage.value) {
                // User cannot belong to NotebookExperiment if they are not using Insiders.
                if (
                    (experiment.name === NativeNotebook.experiment || experiment.name === NativeNotebook.control) &&
                    this.appEnvironment.channel === 'stable'
                ) {
                    continue;
                }
                try {
                    if (
                        this._experimentsOptedOutFrom.includes('All') ||
                        this._experimentsOptedOutFrom.includes(experiment.name)
                    ) {
                        sendTelemetryEvent(EventName.PYTHON_EXPERIMENTS_OPT_IN_OUT, undefined, {
                            expNameOptedOutOf: experiment.name
                        });
                        continue;
                    }
                    if (
                        this._experimentsOptedInto.includes('All') ||
                        this._experimentsOptedInto.includes(experiment.name)
                    ) {
                        sendTelemetryEvent(EventName.PYTHON_EXPERIMENTS_OPT_IN_OUT, undefined, {
                            expNameOptedInto: experiment.name
                        });
                        this.userExperiments.push(experiment);
                    } else {
                        remainingExpriments.push(experiment);
                    }
                } catch (ex) {
                    traceError(`Failed to populate experiment list for experiment '${experiment.name}'`, ex);
                }
            }

            // Add users (based on algorithm) to experiments they haven't already opted out of or opted into.
            remainingExpriments
                .filter((experiment) => this.isUserInRange(experiment.min, experiment.max, experiment.salt))
                .filter((experiment) => !this.userExperiments.some((existing) => existing.salt === experiment.salt))
                .forEach((experiment) => this.userExperiments.push(experiment));
        }
    }

    @traceDecorators.error('Failed to send telemetry when user is in experiment')
    public sendTelemetryIfInExperiment(experimentName: string): void {
        if (this.userExperiments.find((exp) => exp.name === experimentName)) {
            sendTelemetryEvent(EventName.PYTHON_EXPERIMENTS, undefined, { expName: experimentName });
        }
    }

    /**
     * Downloads experiments and updates downloaded storage for the next session given previously downloaded experiments are no longer valid
     */
    @traceDecorators.error('Failed to initialize experiments')
    public async initializeInBackground(): Promise<void> {
        if (this.isDownloadedStorageValid.value) {
            return;
        }
        await this.downloadAndStoreExperiments();
    }

    /**
     * Downloads experiments and updates storage
     * @param storage The storage to store the experiments in. By default, downloaded storage for the next session is used.
     */
    @traceDecorators.error('Failed to download and store experiments')
    public async downloadAndStoreExperiments(
        storage: IPersistentState<ABExperiments | undefined> = this.downloadedExperimentsStorage
    ): Promise<void> {
        const downloadedExperiments = await this.httpClient.getJSON<ABExperiments>(configUri, false);
        if (!this.areExperimentsValid(downloadedExperiments)) {
            return;
        }
        await storage.updateValue(downloadedExperiments);
        await this.isDownloadedStorageValid.updateValue(true);
    }

    /**
     * Checks if user falls between the range of the experiment
     * @param min The lower limit
     * @param max The upper limit
     * @param salt The experiment salt value
     */
    public isUserInRange(min: number, max: number, salt: string): boolean {
        if (typeof this.appEnvironment.machineId !== 'string') {
            throw new Error('Machine ID should be a string');
        }
        let hash: number;
        if (oldExperimentSalts.find((oldSalt) => oldSalt === salt)) {
            hash = this.crypto.createHash(`${this.appEnvironment.machineId}+${salt}`, 'number', 'SHA512');
        } else {
            hash = this.crypto.createHash(`${this.appEnvironment.machineId}+${salt}`, 'number', 'FNV');
        }
        return hash % 100 >= min && hash % 100 < max;
    }

    /**
     * Do best effort to populate experiment storage. Attempt to update experiment storage by,
     * * Using appropriate local data if available
     * * Trying to download fresh experiments within 2 seconds to update storage
     * Local data could be:
     * * Experiments downloaded in the last session
     *   - The function makes sure these are used in the current session
     * * A default experiments file shipped with the extension
     *   - Note this file is only used when experiment storage is empty, which is usually the case the first time the extension loads.
     *   - We have this local file to ensure that experiments are used in the first session itself,
     *     as about 40% of the users never come back for the second session.
     */
    @swallowExceptions('Failed to update experiment storage')
    public async updateExperimentStorage(): Promise<void> {
        if (!process.env.VSC_PYTHON_LOAD_EXPERIMENTS_FROM_FILE) {
            // Step 1. Update experiment storage using downloaded experiments in the last session if any
            if (Array.isArray(this.downloadedExperimentsStorage.value)) {
                await this.experimentStorage.updateValue(this.downloadedExperimentsStorage.value);
                return this.downloadedExperimentsStorage.updateValue(undefined);
            }

            if (Array.isArray(this.experimentStorage.value)) {
                // Experiment storage already contains latest experiments, do not use the following techniques
                return;
            }

            // Step 2. Do best effort to download the experiments within timeout and use it in the current session only
            if ((await this.doBestEffortToPopulateExperiments()) === true) {
                return;
            }
        }

        // Step 3. Update experiment storage using local experiments file if available
        if (await this.fs.fileExists(configFile)) {
            const content = await this.fs.readFile(configFile);
            try {
                const experiments = parse(content, [], { allowTrailingComma: true, disallowComments: false });
                if (!this.areExperimentsValid(experiments)) {
                    throw new Error('Parsed experiments are not valid');
                }
                await this.experimentStorage.updateValue(experiments);
            } catch (ex) {
                traceError('Failed to parse experiments configuration file to update storage', ex);
            }
        }
    }

    /**
     * Checks that experiments are not invalid or incomplete
     * @param experiments Local or downloaded experiments
     * @returns `true` if type of experiments equals `ABExperiments` type, `false` otherwise
     */
    public areExperimentsValid(experiments: ABExperiments): boolean {
        if (!Array.isArray(experiments)) {
            traceError('Experiments are not of array type');
            return false;
        }
        for (const exp of experiments) {
            if (exp.name === undefined || exp.salt === undefined || exp.min === undefined || exp.max === undefined) {
                traceError('Experiments are missing fields from ABExperiments type');
                return false;
            }
        }
        return true;
    }

    /**
     * Do best effort to download the experiments within timeout and use it in the current session only
     */
    public async doBestEffortToPopulateExperiments(): Promise<boolean> {
        try {
            const success = await Promise.race([
                // Download and store experiments in the storage for the current session
                this.downloadAndStoreExperiments(this.experimentStorage).then(() => true),
                sleep(this.experimentEffortTimeout).then(() => false)
            ]);
            sendTelemetryEvent(EventName.PYTHON_EXPERIMENTS_DOWNLOAD_SUCCESS_RATE, undefined, { success });
            return success;
        } catch (ex) {
            sendTelemetryEvent(
                EventName.PYTHON_EXPERIMENTS_DOWNLOAD_SUCCESS_RATE,
                undefined,
                { success: false, error: 'Downloading experiments failed with error' },
                ex
            );
            traceError('Effort to download experiments within timeout failed with error', ex);
            return false;
        }
    }

    public _activated(): boolean {
        return this.activatedOnce;
    }

    /**
     * You can only opt in or out of experiment groups, not control groups. So remove requests for control groups.
     */
    private cleanUpExperimentsOptList(): void {
        for (let i = 0; i < this._experimentsOptedInto.length; i += 1) {
            if (this._experimentsOptedInto[i].endsWith('control')) {
                this._experimentsOptedInto[i] = '';
            }
        }
        for (let i = 0; i < this._experimentsOptedOutFrom.length; i += 1) {
            if (this._experimentsOptedOutFrom[i].endsWith('control')) {
                this._experimentsOptedOutFrom[i] = '';
            }
        }
        this._experimentsOptedInto = this._experimentsOptedInto.filter((exp) => exp !== '');
        this._experimentsOptedOutFrom = this._experimentsOptedOutFrom.filter((exp) => exp !== '');
    }
}
