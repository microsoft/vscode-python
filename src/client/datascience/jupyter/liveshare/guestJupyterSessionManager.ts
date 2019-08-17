// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { CancellationToken } from 'vscode-jsonrpc';

import { Kernel } from '@jupyterlab/services';
import { noop } from '../../../../test/core';
import { IConnection, IJupyterKernelSpec, IJupyterSession, IJupyterSessionManager } from '../../types';

export class GuestJupyterSessionManager implements IJupyterSessionManager {

    public constructor(private realSessionManager: IJupyterSessionManager) {
        noop();
    }

    public startNew(connInfo: IConnection, kernelSpec: IJupyterKernelSpec | undefined, cancelToken?: CancellationToken): Promise<IJupyterSession> {
        return this.realSessionManager.startNew(connInfo, kernelSpec, cancelToken);
    }

    public async getActiveKernels(_connection: IConnection): Promise<Kernel.IModel[]> {
        // Don't return any kernels in guest mode. They're only needed for the host side
        return Promise.resolve([]);
    }

    public async getActiveKernelSpecs(_connection: IConnection): Promise<IJupyterKernelSpec[]> {
        // Don't return any kernel specs in guest mode. They're only needed for the host side
        return Promise.resolve([]);
    }

}
