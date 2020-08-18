// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as uuid from 'uuid/v4';
import { Uri } from 'vscode';
import { TemporaryFile } from '../../client/common/platform/types';
import { noop } from '../../client/common/utils/misc';
import { getNameOfKernelConnection } from '../../client/datascience/jupyter/kernels/helpers';
import {
    IJupyterConnection,
    INotebook,
    INotebookServer,
    INotebookServerLaunchInfo
} from '../../client/datascience/types';
import { MockJupyterNotebook } from './mockJupyterNotebook';

export class MockJupyterServer implements INotebookServer {
    private launchInfo: INotebookServerLaunchInfo | undefined;
    private notebookFile: TemporaryFile | undefined;
    private _id = uuid();

    public get id(): string {
        return this._id;
    }
    public connect(launchInfo: INotebookServerLaunchInfo): Promise<void> {
        if (launchInfo && launchInfo.connectionInfo && launchInfo.kernelConnectionMetadata) {
            this.launchInfo = launchInfo;

            // Validate connection info and kernel spec
            const name = getNameOfKernelConnection(launchInfo.kernelConnectionMetadata);
            if (launchInfo.connectionInfo.baseUrl && name && /[a-z,A-Z,0-9,-,.,_]+/.test(name)) {
                return Promise.resolve();
            }
        }
        return Promise.reject('invalid server startup');
    }

    public async createNotebook(_resource: Uri): Promise<INotebook> {
        return new MockJupyterNotebook(this.getConnectionInfo());
    }

    public async getNotebook(_resource: Uri): Promise<INotebook | undefined> {
        return new MockJupyterNotebook(this.getConnectionInfo());
    }

    public async setMatplotLibStyle(_useDark: boolean): Promise<void> {
        noop();
    }
    public getConnectionInfo(): IJupyterConnection | undefined {
        return this.launchInfo ? this.launchInfo.connectionInfo : undefined;
    }
    public waitForConnect(): Promise<INotebookServerLaunchInfo | undefined> {
        throw new Error('Method not implemented');
    }
    public async shutdown() {
        return Promise.resolve();
    }

    public async dispose(): Promise<void> {
        if (this.launchInfo) {
            this.launchInfo.connectionInfo.dispose(); // This should kill the process that's running
            this.launchInfo = undefined;
        }
        if (this.notebookFile) {
            this.notebookFile.dispose(); // This destroy any unwanted kernel specs if necessary
            this.notebookFile = undefined;
        }
    }
}
