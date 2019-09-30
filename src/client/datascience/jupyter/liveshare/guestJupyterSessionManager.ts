// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { CancellationToken } from 'vscode-jsonrpc';

import { noop } from '../../../../test/core';
import { IConnection, IJupyterKernelSpec, IJupyterSession, IJupyterSessionManager } from '../../types';

export class GuestJupyterSessionManager implements IJupyterSessionManager {
    private connInfo: IConnection | undefined;

    public constructor(private realSessionManager: IJupyterSessionManager) {
        noop();
    }

    public startNew(kernelSpec: IJupyterKernelSpec | undefined, cancelToken?: CancellationToken): Promise<IJupyterSession> {
        return this.realSessionManager.startNew(kernelSpec, cancelToken);
    }

    public async getActiveKernelSpecs(): Promise<IJupyterKernelSpec[]> {
        // Don't return any kernel specs in guest mode. They're only needed for the host side
        return Promise.resolve([]);
    }

    public async dispose(): Promise<void> {
        noop();
    }

    public async initialize(_connInfo: IConnection): Promise<void> {
        this.connInfo = _connInfo;
    }

    public getConnInfo(): IConnection {
        return this.connInfo!;
    }

}
