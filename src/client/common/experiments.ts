// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// Refer to A/B testing wiki for more details: https://en.wikipedia.org/wiki/A/B_testing

'use strict';

import { inject, injectable, named } from 'inversify';
import { parse } from 'jsonc-parser';
import * as path from 'path';
import { IHttpClient } from '../common/types';
import { isTelemetryDisabled, sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { IApplicationEnvironment, IWorkspaceService } from './application/types';
import { EXTENSION_ROOT_DIR, STANDARD_OUTPUT_CHANNEL } from './constants';
import { traceDecorators, traceError } from './logger';
import { IFileSystem } from './platform/types';
import { ABExperiments, ICryptoUtils, IExperimentsManager, IOutputChannel, IPersistentState, IPersistentStateFactory } from './types';
import { swallowExceptions } from './utils/decorators';
import { Experiments } from './utils/localize';

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
    constructor(
        @inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IHttpClient) private readonly httpClient: IHttpClient,
        @inject(ICryptoUtils) private readonly crypto: ICryptoUtils,
        @inject(IApplicationEnvironment) private readonly appEnvironment: IApplicationEnvironment,
        @inject(IOutputChannel) @named(STANDARD_OUTPUT_CHANNEL) private readonly output: IOutputChannel,
        @inject(IFileSystem) private readonly fs: IFileSystem
    ) {
        this.isDownloadedStorageValid = this.persistentStateFactory.createGlobalPersistentState<boolean>(isDownloadedStorageValidKey, false, EXPIRY_DURATION_MS);
        this.experimentStorage = this.persistentStateFactory.createGlobalPersistentState<ABExperiments | undefined>(experimentStorageKey, undefined);
        this.downloadedExperimentsStorage = this.persistentStateFactory.createGlobalPersistentState<ABExperiments | undefined>(downloadedExperimentStorageKey, undefined);
    }

    @swallowExceptions('Failed to activate experiments')
    public async activate(): Promise<void> {
        if (this.activatedOnce || isTelemetryDisabled(this.workspaceService)) {
            return;
        }
        this.activatedOnce = true;
        await this.updateExperimentStorage();
        this.populateUserExperiments();
        for (const exp of this.userExperiments || []) {
            // We need to know whether an experiment influences the logs we observe in github issues, so log the experiment group
            this.output.appendLine(Experiments.inGroup().format(exp.name));
        }
        this.downloadAndStoreExperiments().ignoreErrors();
    }

    @traceDecorators.error('Failed to identify if user is in experiment')
    public inExperiment(experimentName: string): boolean {
        this.sendTelemetryIfInExperiment(experimentName);
        return this.userExperiments.find(exp => exp.name === experimentName) ? true : false;
    }

    /**
     * Populates list of experiments user is in
     */
    @traceDecorators.error('Failed to populate user experiments')
    public populateUserExperiments(): void {
        if (Array.isArray(this.experimentStorage.value)) {
            for (const experiment of this.experimentStorage.value) {
                try {
                    if (this.isUserInRange(experiment.min, experiment.max, experiment.salt)) {
                        this.userExperiments.push(experiment);
                    }
                } catch (ex) {
                    traceError(`Failed to populate experiment list for experiment '${experiment.name}'`, ex);
                }
            }
        }
    }

    @traceDecorators.error('Failed to send telemetry when user is in experiment')
    public sendTelemetryIfInExperiment(experimentName: string): void {
        if (this.userExperiments.find(exp => exp.name === experimentName)) {
            sendTelemetryEvent(EventName.PYTHON_EXPERIMENTS, undefined, { expName: experimentName });
        }
    }

    /**
     * Downloads experiments and updates storage given previously downloaded experiments are no longer valid
     * @param timeout If provided, wait for download to complete until timeout, and return `null` if download fails to complete
     */
    @traceDecorators.error('Failed to download experiments')
    public async downloadAndStoreExperiments(timeout?: number): Promise<void | null> {
        if (this.isDownloadedStorageValid.value) {
            return;
        }
        const downloadedExperiments = await this.httpClient.getJSON<ABExperiments>(configUri, false, timeout);
        if (downloadedExperiments === null) {
            return null;
        }
        if (!this.areExperimentsValid(downloadedExperiments)) {
            return;
        }
        if (timeout) {
            // If timeout is specified, we intend to use experiments in the current session itself, hence update storage for the current session
            await this.experimentStorage.updateValue(downloadedExperiments);
        } else {
            // Carries experiments to be used from the next session
            await this.downloadedExperimentsStorage.updateValue(downloadedExperiments);
        }
        await this.isDownloadedStorageValid.updateValue(true);
    }

    /**
     * Checks if user falls between the range of the experiment
     * @param min The lower limit
     * @param max The upper limit
     * @param salt The experiment salt value
     */
    public isUserInRange(min: number, max: number, salt: string): boolean {
        if (typeof (this.appEnvironment.machineId) !== 'string') {
            throw new Error('Machine ID should be a string');
        }
        const hash = this.crypto.createHash(`${this.appEnvironment.machineId}+${salt}`, 'number');
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
        // Step 1. Update experiment storage using downloaded experiments in the last session if any
        if (Array.isArray(this.downloadedExperimentsStorage.value)) {
            await this.experimentStorage.updateValue(this.downloadedExperimentsStorage.value);
            return this.downloadedExperimentsStorage.updateValue(undefined);
        }

        if (Array.isArray(this.experimentStorage.value)) {
            // Experiment storage already contains latest experiments, do not use the following techniques
            return;
        }

        // Step 2. Do best effort to download the experiments within 2 seconds and use it in the current session only
        if (await this.doBestEffortToPopulateExperiments() === true) {
            return;
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
     * Do best effort to download the experiments within 2 seconds and use it in the current session only
     */
    public async doBestEffortToPopulateExperiments(): Promise<boolean> {
        try {
            const success = await this.downloadAndStoreExperiments(2000) !== null;
            sendTelemetryEvent(EventName.PYTHON_EXPERIMENTS_DOWNLOAD_SUCCESS_RATE, undefined, { success });
            return success;
        } catch (ex) {
            sendTelemetryEvent(EventName.PYTHON_EXPERIMENTS_DOWNLOAD_SUCCESS_RATE, undefined, { success: false, error: 'Downloading experiments failed with error' }, ex);
            traceError('Effort to downlad experiments within 2 seconds failed with error', ex);
            return false;
        }
    }
}
