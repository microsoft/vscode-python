// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// Refer to A/B testing wiki for more details: https://en.wikipedia.org/wiki/A/B_testing

'use strict';

import { inject, injectable, named } from 'inversify';
import { Uri } from 'vscode';
import { IHttpClient } from '../activation/types';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { IApplicationEnvironment, IWorkspaceService } from './application/types';
import { STANDARD_OUTPUT_CHANNEL } from './constants';
import { traceDecorators, traceError } from './logger';
import { ABExperiments, ICryptoUtils, IExperimentsManager, IOutputChannel, IPersistentState, IPersistentStateFactory, Resource } from './types';
import { swallowExceptions } from './utils/decorators';
import { Experiments } from './utils/localize';

const EXPIRY_DURATION_MS = 30 * 60 * 1000;
export const isStorageValidKey = 'IS_EXPERIMENTS_STORAGE_VALID_KEY';
export const experimentStorageKey = 'EXPERIMENT_STORAGE_KEY';
const configUri = 'https://raw.githubusercontent.com/microsoft/vscode-python/master/environments.json';

@injectable()
export class ExperimentsManager implements IExperimentsManager {
    public experimentStorage: IPersistentState<ABExperiments | undefined>;
    private isStorageValid: IPersistentState<boolean>;
    private activatedWorkspaces = new Map<string, boolean>();
    private loggedOnce: boolean = false;
    private experimentsEnabled: boolean = true;
    private resource: Resource;
    constructor(
        @inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IHttpClient) private readonly httpClient: IHttpClient,
        @inject(ICryptoUtils) private readonly crypto: ICryptoUtils,
        @inject(IApplicationEnvironment) private readonly appEnvironment: IApplicationEnvironment,
        @inject(IOutputChannel) @named(STANDARD_OUTPUT_CHANNEL) private readonly output: IOutputChannel
    ) {
        this.isStorageValid = this.persistentStateFactory.createGlobalPersistentState<boolean>(isStorageValidKey, false, EXPIRY_DURATION_MS);
        this.experimentStorage = this.persistentStateFactory.createGlobalPersistentState<ABExperiments | undefined>(experimentStorageKey, undefined);
    }

    @swallowExceptions('Failed to activate experiments')
    public async activate(resource: Uri): Promise<void> {
        const wkspcKey = this.getWorkspacePathKey(resource);
        if (this.activatedWorkspaces.has(wkspcKey)) {
            return;
        }
        this.activatedWorkspaces.set(wkspcKey, true);
        if (!this.loggedOnce) {
            this.logExperimentGroups();
            this.loggedOnce = true;
        }
        this.resource = resource;
        this.initializeInBackground().ignoreErrors();
    }

    @traceDecorators.error('Failed to initialize experiments')
    public async initializeInBackground() {
        if (this.isTelemetryDisabled() || !Array.isArray(this.experimentStorage.value) || this.isStorageValid.value) {
            this.experimentsEnabled = false;
            return;
        }
        const downloadedExperiments = await this.httpClient.getJSON<ABExperiments>(configUri, false);
        await this.experimentStorage.updateValue(downloadedExperiments);
        await this.isStorageValid.updateValue(true);
    }

    public inExperiment(experimentName: string): boolean | undefined {
        try {
            if (!this.experimentsEnabled) {
                return;
            }
            const experiments = this.experimentStorage.value ? this.experimentStorage.value : [];
            const experiment = experiments.find(exp => exp.name === experimentName);
            if (!experiment) {
                return false;
            }
            const inExp = this.isUserInRange(experiment.min, experiment.max, experiment.salt);
            if (inExp) {
                sendTelemetryEvent(EventName.PYTHON_EXPERIMENTS, undefined, { expName: experimentName });
                return true;
            }
        } catch (ex) {
            traceError(`Failed to check if user is in experiment '${experimentName}'`, ex);
        }
        return false;
    }

    public isTelemetryDisabled(): boolean {
        const settings = this.workspaceService.getConfiguration('telemetry', this.resource).inspect<boolean>('enableTelemetry')!;
        return (settings.workspaceFolderValue === false ||
            (settings.workspaceFolderValue !== true && settings.workspaceValue === false) ||
            (settings.workspaceFolderValue !== true && settings.workspaceValue !== true && settings.globalValue === false)) ? true : false;
    }

    private isUserInRange(min: number, max: number, salt: string) {
        const hash = this.crypto.createHash(`${this.appEnvironment.machineId}+${salt}`, 'hex', 'number');
        return hash % 100 >= min && hash % 100 < max;
    }

    private getWorkspacePathKey(resource: Resource): string {
        return this.workspaceService.getWorkspaceFolderIdentifier(resource, '');
    }

    @traceDecorators.error('Failed to log experiment groups')
    private logExperimentGroups(): void {
        if (Array.isArray(this.experimentStorage.value)) {
            for (const experiment of this.experimentStorage.value) {
                if (this.isUserInRange(experiment.min, experiment.max, experiment.salt)) {
                    this.output.appendLine(Experiments.inGroup().format(experiment.name));
                }
            }
        }
    }
}
