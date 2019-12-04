// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import * as portfinder from 'portfinder';
import * as uuid from 'uuid/v4';

import { IServiceContainer } from '../../../ioc/types';
import { traceError, traceInfo } from '../../logger';
import { IProcessServiceFactory } from '../../process/types';
import { IDisposableRegistry } from '../../types';
import { IWebPanel, IWebPanelOptions, IWebPanelProvider } from '../types';
import { WebPanel } from './webPanel';

@injectable()
export class WebPanelProvider implements IWebPanelProvider {

    private port: number | undefined;
    private token: string | undefined;

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
    }

    // tslint:disable-next-line:no-any
    public async create(options: IWebPanelOptions): Promise<IWebPanel> {
        const serverData = options.startHttpServer ? await this.ensureServerIsRunning() : { port: undefined, token: undefined };
        return new WebPanel(this.serviceContainer.get<IDisposableRegistry>(IDisposableRegistry), serverData.port, serverData.token, options);
    }

    private async ensureServerIsRunning(): Promise<{ port: number; token: string }> {
        if (!this.port || !this.token) {
            // Compute a usable port.
            this.port = await portfinder.getPortPromise({ startPort: 9000, port: 9000 });
            this.token = uuid();

            // Start the service. Wait for it to start before talking to it.
            try {
                const ps = await this.serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory).create();
                const server = ps.execObservable('node', [path.join(__dirname, 'webPanelServer.js'), '--port', this.port.toString(), '--token', this.token]);
                traceInfo(`WebServer startup on port ${this.port}`);

                // Subscribe to output so we can trace it
                server.out.subscribe(
                    next => {
                        traceInfo(`WebServer output: ${next.out}`);
                    },
                    error => {
                        traceInfo(`WebServer error: ${error}`);
                    },
                    () => {
                        traceInfo(`WebServer shutdown ${this.port}`);
                    });
            } catch (e) {
                traceError(`WebServer launch failure: ${e}`);
                throw e;
            }
        }

        return { port: this.port, token: this.token };
    }
}
