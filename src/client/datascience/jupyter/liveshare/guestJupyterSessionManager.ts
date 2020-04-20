// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { CancellationToken } from 'vscode-jsonrpc';

import type { Session } from '@jupyterlab/services';
import { noop } from '../../../common/utils/misc';
import {
    IJupyterConnection,
    IJupyterKernel,
    IJupyterKernelSpec,
    IJupyterSession,
    IJupyterSessionManager
} from '../../types';
import { LiveKernelModel } from '../kernels/types';

export class GuestJupyterSessionManager implements IJupyterSessionManager {
    private connInfo: IJupyterConnection | undefined;

    public constructor(private realSessionManager: IJupyterSessionManager) {
        noop();
    }

    public startNew(
        kernelSpec: IJupyterKernelSpec | LiveKernelModel | undefined,
        cancelToken?: CancellationToken
    ): Promise<IJupyterSession> {
        return this.realSessionManager.startNew(kernelSpec, cancelToken);
    }

    public async getKernelSpecs(): Promise<IJupyterKernelSpec[]> {
        // Don't return any kernel specs in guest mode. They're only needed for the host side
        return Promise.resolve([]);
    }

    public getRunningKernels(): Promise<IJupyterKernel[]> {
        return Promise.resolve([]);
    }

    public getRunningSessions(): Promise<Session.IModel[]> {
        return Promise.resolve([]);
    }

    public async dispose(): Promise<void> {
        noop();
    }

    public async initialize(_connInfo: IJupyterConnection): Promise<void> {
        this.connInfo = _connInfo;
    }

    public getConnInfo(): IJupyterConnection {
        return this.connInfo!;
    }
}
