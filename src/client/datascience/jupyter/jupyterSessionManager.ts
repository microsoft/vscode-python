// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { ServerConnection, SessionManager } from '@jupyterlab/services';
import { injectable } from 'inversify';
import { CancellationToken } from 'vscode-jsonrpc';

import { IConnection, IJupyterKernelSpec, IJupyterSession, IJupyterSessionManager } from '../types';
import { JupyterKernelSpec } from './jupyterKernelSpec';
import { JupyterSession } from './jupyterSession';

@injectable()
export class JupyterSessionManager implements IJupyterSessionManager {

    public async startNew(connInfo: IConnection, kernelSpec: IJupyterKernelSpec | undefined, cancelToken?: CancellationToken) : Promise<IJupyterSession> {
        // Create a new session and attempt to connect to it
        const session = new JupyterSession(connInfo, kernelSpec);
        try {
            await session.connect(cancelToken);
        } finally {
            if (!session.isConnected) {
                await session.dispose();
            }
        }
        return session;
    }

    public async getActiveKernelSpecs(connection: IConnection) : Promise<IJupyterKernelSpec[]> {
        // Use our connection to create a session manager
        const serverSettings = ServerConnection.makeSettings(
            {
                baseUrl: connection.baseUrl,
                token: connection.token,
                pageUrl: '',
                // A web socket is required to allow token authentication (what if there is no token authentication?)
                wsUrl: connection.baseUrl.replace('http', 'ws'),
                init: { cache: 'no-store', credentials: 'same-origin' }
            });
        const sessionManager = new SessionManager({ serverSettings: serverSettings });
        try {
            // Ask the session manager to refresh its list of kernel specs.
            await sessionManager.refreshSpecs();

            // Enumerate all of the kernel specs, turning each into a JupyterKernelSpec
            const kernelspecs = sessionManager.specs && sessionManager.specs.kernelspecs ? sessionManager.specs.kernelspecs : {};
            const keys = Object.keys(kernelspecs);
            return keys.map(k => {
                const spec = kernelspecs[k];
                return new JupyterKernelSpec(spec) as IJupyterKernelSpec;
            });
        } catch {
            // For some reason this is failing. Just return nothing
            return [];
        } finally {
            // Cleanup the session manager as we don't need it anymore
            if (sessionManager) {
                sessionManager.dispose();
            }
        }

    }

}
