// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// Refer to A/B testing wiki for more details: https://en.wikipedia.org/wiki/A/B_testing

'use strict';

import { inject, injectable, named } from 'inversify';
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
    IOutputChannel,
    IPersistentState,
    IPersistentStateFactory,
    IPythonSettings,
} from '../types';
import { swallowExceptions } from '../utils/decorators';
import { Experiments } from '../utils/localize';

export const experimentStorageKey = 'EXPERIMENT_STORAGE_KEY';
/**
 * Local experiments config file. We have this to ensure that experiments are used in the first session itself,
 * as about 40% of the users never come back for the second session.
 */
const configFile = path.join(EXTENSION_ROOT_DIR, 'experiments.json');
export const oldExperimentSalts = ['LS'];

/**
 * <DEPRECATED> Manages and stores experiments, implements the AB testing functionality
 * @deprecated
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
     * Keeps track if the storage needs updating or not.
     * Note this has to be separate from the actual storage as
     * download storages by itself should not have an Expiry (so that it can be used in the next session even when download fails in the current session)
     */
    private activatedOnce: boolean = false;
    private settings!: IPythonSettings;

    constructor(
        @inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory,
        @inject(ICryptoUtils) private readonly crypto: ICryptoUtils,
        @inject(IApplicationEnvironment) private readonly appEnvironment: IApplicationEnvironment,
        @inject(IOutputChannel) @named(STANDARD_OUTPUT_CHANNEL) private readonly output: IOutputChannel,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(IConfigurationService) private readonly configurationService: IConfigurationService,
    ) {
        this.experimentStorage = this.persistentStateFactory.createGlobalPersistentState<ABExperiments | undefined>(
            experimentStorageKey,
            undefined,
        );
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
                try {
                    if (
                        this._experimentsOptedOutFrom.includes('All') ||
                        this._experimentsOptedOutFrom.includes(experiment.name)
                    ) {
                        sendTelemetryEvent(EventName.PYTHON_EXPERIMENTS_OPT_IN_OUT, undefined, {
                            expNameOptedOutOf: experiment.name,
                        });
                        continue;
                    }
                    if (
                        this._experimentsOptedInto.includes('All') ||
                        this._experimentsOptedInto.includes(experiment.name)
                    ) {
                        sendTelemetryEvent(EventName.PYTHON_EXPERIMENTS_OPT_IN_OUT, undefined, {
                            expNameOptedInto: experiment.name,
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
     * Do best effort to populate experiment storage.
     * Attempt to update experiment storage by using appropriate local data if available.
     * Local data could be a default experiments file shipped with the extension.
     *   - Note this file is only used when experiment storage is empty, which is usually the case the first time the extension loads.
     *   - We have this local file to ensure that experiments are used in the first session itself,
     *     as about 40% of the users never come back for the second session.
     */
    @swallowExceptions('Failed to update experiment storage')
    public async updateExperimentStorage(): Promise<void> {
        if (!process.env.VSC_PYTHON_LOAD_EXPERIMENTS_FROM_FILE) {
            if (Array.isArray(this.experimentStorage.value)) {
                // Experiment storage already contains latest experiments, do not use the following techniques
                return;
            }
        }

        // Update experiment storage using local experiments file if available.
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
