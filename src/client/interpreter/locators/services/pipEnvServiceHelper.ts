// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { IFileSystem } from '../../../common/platform/types';
import { IPersistentState, IPersistentStateFactory } from '../../../common/types';
import { IPipEnvServiceHelper } from '../types';

type PipEnvInformation = { pythonPath: string; workspaceFolder: string; envName: string };
@injectable()
export class PipEnvServiceHelper implements IPipEnvServiceHelper {
    private initialized = false;
    private readonly state: IPersistentState<ReadonlyArray<PipEnvInformation>>;
    constructor(@inject(IPersistentStateFactory) private readonly statefactory: IPersistentStateFactory, @inject(IFileSystem) private readonly fs: IFileSystem) {
        this.state = this.statefactory.createGlobalPersistentState<ReadonlyArray<PipEnvInformation>>('PipEnvInformation', []);
    }
    public async getPipEnvInfo(pythonPath: string): Promise<{ workspaceFolder: Uri; envName: string } | undefined> {
        await this.initializeStateStore();
        const info = this.state.value.find(item => this.fs.arePathsSame(item.pythonPath, pythonPath));
        return info ? { workspaceFolder: Uri.file(info.workspaceFolder), envName: info.envName } : undefined;
    }
    public async trackWorkspaceFolder(pythonPath: string, workspaceFolder: Uri): Promise<void> {
        await this.initializeStateStore();
        const values = [...this.state.value].filter(item => !this.fs.arePathsSame(item.pythonPath, pythonPath));
        const envName = path.basename(workspaceFolder.fsPath);
        values.push({ pythonPath, workspaceFolder: workspaceFolder.fsPath, envName });
        await this.state.updateValue(values);
    }
    protected async initializeStateStore() {
        if (this.initialized) {
            return;
        }
        const list = await Promise.all(this.state.value.map(async item => ((await this.fs.fileExists(item.pythonPath)) ? item : undefined)));
        const filteredList = list.filter(item => !!item) as PipEnvInformation[];
        await this.state.updateValue(filteredList);
        this.initialized = true;
    }
}
