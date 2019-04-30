// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import * as vscode from 'vscode';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../test/constants';
import { IWorkspaceService } from '../common/application/types';
import { traceDecorators, traceError } from '../common/logger';
import { IFileSystem } from '../common/platform/types';
import { ICryptoUtils, IPersistentStateFactory } from '../common/types';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { IExperimentsManager, IHttpClient } from './types';

const EXPIRY_DURATION_MS = 30 * 60 * 1000;
const experimentTimestampKey = 'EXPERIMENT_TIMESTAMP_KEY';
const experimentsLocation = path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'client', 'experiments.json');

@injectable()
export class ExperimentsManager implements IExperimentsManager {
    private experiments: { name: string; salt: string; min: number; max: number }[] = [];
    constructor(
        @inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IFileSystem) private fs: IFileSystem,
        @inject(IHttpClient) private readonly httpClient: IHttpClient,
        @inject(ICryptoUtils) private readonly crypto: ICryptoUtils
    ) { }

    public async initialize() {
        if (this.isTelemetryDisabled()) {
            return;
        }
        const IsFileValid = this.persistentStateFactory.createGlobalPersistentState(experimentTimestampKey, false, EXPIRY_DURATION_MS);
        if (await this.fs.fileExists(experimentsLocation) && IsFileValid.value) {
            try {
                this.experiments = JSON.parse(await this.fs.readFile(experimentsLocation));
            } catch (ex) {
                traceError('Failed to parse content from experiments file', ex);
            }
            return;
        }
        try {
            await this.downloadExperiments();
        } catch (err) {
            sendTelemetryEvent(EventName.PYTHON_EXPERIMENTS, undefined, { error: 'Failed to download experiments file' }, err);
            return;
        }
        await IsFileValid.updateValue(true);
        this.experiments.forEach(experiment => sendTelemetryEvent(EventName.PYTHON_EXPERIMENTS, undefined, experiment));
    }

    public async inExperiment(experimentName: string): Promise<boolean> {
        const experimentNames = this.experiments.map(experiment => experiment.name);
        const index = experimentNames.indexOf(experimentName);
        if (index < 0) {
            return false;
        }
        const hash = await this.crypto.createHash('sha512', `${vscode.env.machineId}+${this.experiments[index].salt}`, 'hex', 'number') as number;
        return hash % 100 >= this.experiments[index].min && hash % 100 < this.experiments[index].max;
    }

    @traceDecorators.error('Failed to download experiments file')
    protected async downloadExperiments() {
        this.experiments = await this.httpClient.getJSON('https://raw.githubusercontent.com/karrtikr/check/master/environments.json');
        await this.fs.writeFile(experimentsLocation, JSON.stringify(this.experiments, null, 4));
    }

    protected isTelemetryDisabled(): boolean {
        const settings = this.workspaceService.getConfiguration('telemetry')!.inspect<boolean>('enableTelemetry')!;
        return (settings.workspaceFolderValue === false || settings.workspaceValue === false || settings.globalValue === false) ? true : false;
    }
}
