// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { inject, injectable } from 'inversify';
import { IApplicationEnvironment, IWorkspaceService } from '../common/application/types';
import { traceDecorators, traceError } from '../common/logger';
import { ICryptoUtils, IPersistentStateFactory } from '../common/types';
import { swallowExceptions } from '../common/utils/decorators';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { IExperimentsManager, IHttpClient } from './types';

const EXPIRY_DURATION_MS = 30 * 60 * 1000;
const experimentStorageKey = 'EXPERIMENT_STORAGE_KEY';
const configUri = 'https://raw.githubusercontent.com/karrtikr/check/master/environments.json';

@injectable()
export class ExperimentsManager implements IExperimentsManager {
    private experiments: { name: string; salt: string; min: number; max: number }[] = [];
    constructor(
        @inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IHttpClient) private readonly httpClient: IHttpClient,
        @inject(ICryptoUtils) private readonly crypto: ICryptoUtils,
        @inject(IApplicationEnvironment) private readonly appEnvironment: IApplicationEnvironment
    ) { }

    public async initialize() {
        if (this.isTelemetryDisabled()) {
            return;
        }
        const experimentStorage = this.persistentStateFactory.createGlobalPersistentState(experimentStorageKey, undefined as any, EXPIRY_DURATION_MS);
        if (experimentStorage.value) {
            this.experiments = experimentStorage.value;
            return;
        }
        await this.downloadExperiments();
        await experimentStorage.updateValue(this.experiments);
        this.experiments.forEach(experiment => sendTelemetryEvent(EventName.PYTHON_EXPERIMENTS, undefined, experiment));
    }

    public async inExperiment(experimentName: string): Promise<boolean> {
        try {
            const experimentNames = this.experiments.map(experiment => experiment.name);
            const index = experimentNames.indexOf(experimentName);
            if (index < 0) {
                return false;
            }
            const hash = await this.crypto.createHash(`${this.appEnvironment.machineId}+${this.experiments[index].salt}`, 'hex', 'number') as number;
            return hash % 100 >= this.experiments[index].min && hash % 100 < this.experiments[index].max;
        } catch (ex) {
            traceError('Failed to check if user is in experiment', ex);
            return false;
        }
    }

    @swallowExceptions('Download experiments')
    @traceDecorators.error('Failed to download experiments')
    protected async downloadExperiments() {
        this.experiments = await this.httpClient.getJSONC(configUri, { allowTrailingComma: true, disallowComments: false });
    }

    protected isTelemetryDisabled(): boolean {
        const settings = this.workspaceService.getConfiguration('telemetry')!.inspect<boolean>('enableTelemetry')!;
        return (settings.workspaceFolderValue === false || settings.workspaceValue === false || settings.globalValue === false) ? true : false;
    }
}
