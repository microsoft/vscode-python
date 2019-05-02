// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IHttpClient } from '../activation/types';
import { IApplicationEnvironment, IWorkspaceService } from './application/types';
import { traceDecorators, traceError } from './logger';
import { ICryptoUtils, IExperimentsManager, IPersistentStateFactory, Resource } from './types';

const EXPIRY_DURATION_MS = 30 * 60 * 1000;
const experimentStorageKey = 'EXPERIMENT_STORAGE_KEY';
const configUri = 'https://raw.githubusercontent.com/karrtikr/check/master/environments.json';

@injectable()
export class ExperimentsManager implements IExperimentsManager {
    private experiments: { name: string; salt: string; min: number; max: number }[] = [];
    private resource: Resource;
    constructor(
        @inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IHttpClient) private readonly httpClient: IHttpClient,
        @inject(ICryptoUtils) private readonly crypto: ICryptoUtils,
        @inject(IApplicationEnvironment) private readonly appEnvironment: IApplicationEnvironment
    ) { }

    public async activate(resource: Uri): Promise<void> {
        this.resource = resource;
        this.initializeInBackground().ignoreErrors();
    }

    @traceDecorators.error('Failed to initialize experiments')
    public async initializeInBackground() {
        if (this.isTelemetryDisabled()) {
            return;
        }
        const experimentStorage = this.persistentStateFactory.createGlobalPersistentState(experimentStorageKey, undefined as any, EXPIRY_DURATION_MS);
        if (experimentStorage.value) {
            this.experiments = experimentStorage.value;
            return;
        }
        try {
            await this.downloadExperiments();
        } catch {
            return;
        }
        await experimentStorage.updateValue(this.experiments);
    }

    public inExperiment(experimentName: string): boolean {
        try {
            const experimentNames = this.experiments.map(experiment => experiment.name);
            const index = experimentNames.indexOf(experimentName);
            if (index < 0) {
                return false;
            }
            const hash = this.crypto.createHash(`${this.appEnvironment.machineId}+${this.experiments[index].salt}`, 'hex', 'number');
            return hash % 100 >= this.experiments[index].min && hash % 100 < this.experiments[index].max;
        } catch (ex) {
            traceError('Failed to check if user is in experiment', ex);
            return false;
        }
    }

    public isTelemetryDisabled(): boolean {
        const settings = this.workspaceService.getConfiguration('telemetry', this.resource)!.inspect<boolean>('enableTelemetry')!;
        return (settings.workspaceFolderValue === false ||
            (settings.workspaceFolderValue !== true && settings.workspaceValue === false) ||
            (settings.workspaceFolderValue !== true && settings.workspaceValue !== true && settings.globalValue === false)) ? true : false;
    }

    @traceDecorators.error('Failed to download experiments')
    private async downloadExperiments() {
        this.experiments = await this.httpClient.getJSONC(configUri, { allowTrailingComma: true, disallowComments: false });
    }
}
