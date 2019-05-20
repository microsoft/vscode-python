// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { Uri } from 'vscode';
import { IHttpClient } from '../activation/types';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { IApplicationEnvironment, IWorkspaceService } from './application/types';
import { STANDARD_OUTPUT_CHANNEL } from './constants';
import { traceDecorators, traceError } from './logger';
import { ICryptoUtils, IExperimentsManager, IOutputChannel, IPersistentState, IPersistentStateFactory, Resource } from './types';
import { Experiments } from './utils/localize';

const EXPIRY_DURATION_MS = 30 * 60 * 1000;
const experimentStorageKey = 'EXPERIMENT_STORAGE_KEY';
const configUri = 'https://raw.githubusercontent.com/karrtikr/check/master/environments.json';

type ABExperiments = { name: string; salt: string; min: number; max: number }[];
@injectable()
export class ExperimentsManager implements IExperimentsManager {
    private experimentStorage: IPersistentState<ABExperiments | undefined>;
    private activatedWorkspaces = new Map<string, boolean>();
    private resource: Resource;
    constructor(
        @inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IHttpClient) private readonly httpClient: IHttpClient,
        @inject(ICryptoUtils) private readonly crypto: ICryptoUtils,
        @inject(IApplicationEnvironment) private readonly appEnvironment: IApplicationEnvironment,
        @inject(IOutputChannel) @named(STANDARD_OUTPUT_CHANNEL) private readonly output: IOutputChannel
    ) {
        this.experimentStorage = this.persistentStateFactory.createGlobalPersistentState<ABExperiments | undefined>(experimentStorageKey, undefined, EXPIRY_DURATION_MS);
    }

    public async activate(resource: Uri): Promise<void> {
        if (this.activatedWorkspaces.has(this.getWorkspacePathKey(resource))) {
            return;
        }
        this.activatedWorkspaces.set(this.getWorkspacePathKey(resource), true);
        this.resource = resource;
        this.initializeInBackground().ignoreErrors();
    }

    @traceDecorators.error('Failed to initialize experiments')
    public async initializeInBackground() {
        if (this.isTelemetryDisabled() || this.experimentStorage.value) {
            return;
        }
        const downloadedExperiments = await this.httpClient.getJSONC<ABExperiments>(configUri);
        await this.experimentStorage.updateValue(downloadedExperiments);
    }

    public inExperiment(experimentName: string): boolean {
        try {
            const experiments = this.experimentStorage.value ? this.experimentStorage.value : [];
            const experiment = experiments.find(exp => exp.name === experimentName);
            if (!experiment) {
                return false;
            }
            const inExp = this.isUserInRange(experiment.min, experiment.max, experiment.salt);
            if (inExp) {
                sendTelemetryEvent(EventName.PYTHON_EXPERIMENTS, undefined, { expName: experimentName });
                // tslint:disable-next-line:messages-must-be-localized
                this.output.appendLine(Experiments.inGroup().format(experimentName));
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
}
