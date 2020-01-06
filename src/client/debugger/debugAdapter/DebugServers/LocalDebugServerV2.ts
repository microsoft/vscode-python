// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as net from 'net';
import { DebugSession } from 'vscode-debugadapter';
import { ISocketServer } from '../../../common/types';
import { createDeferred } from '../../../common/utils/async';
import { IServiceContainer } from '../../../ioc/types';
import { LaunchRequestArguments } from '../../types';
import { IDebugServer } from '../Common/Contracts';
import { BaseDebugServer } from './BaseDebugServer';

export class LocalDebugServerV2 extends BaseDebugServer {
    private socketServer?: ISocketServer;

    constructor(debugSession: DebugSession, private args: LaunchRequestArguments, private serviceContainer: IServiceContainer) {
        super(debugSession);
        this.clientSocket = createDeferred<net.Socket>();
    }

    public Stop() {
        if (this.socketServer) {
            try {
                this.socketServer.dispose();
                // tslint:disable-next-line:no-empty
            } catch {}
            this.socketServer = undefined;
        }
    }

    public async Start(): Promise<IDebugServer> {
        const host = typeof this.args.host === 'string' && this.args.host.trim().length > 0 ? this.args.host!.trim() : 'localhost';
        const socketServer = (this.socketServer = this.serviceContainer.get<ISocketServer>(ISocketServer));
        const port = await socketServer.Start({ port: this.args.port, host });
        socketServer.client
            .then(socket => {
                // This is required to prevent the launcher from aborting if the PTVSD process spits out any errors in stderr stream.
                this.isRunning = true;
                this.debugClientConnected.resolve(true);
                this.clientSocket.resolve(socket);
            })
            .catch(ex => {
                this.debugClientConnected.reject(ex);
                this.clientSocket.reject(ex);
            });
        return { port, host };
    }
}
