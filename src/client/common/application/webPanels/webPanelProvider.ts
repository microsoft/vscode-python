// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import * as portfinder from 'portfinder';

import { IServiceContainer } from '../../../ioc/types';
import { traceInfo, traceError } from '../../logger';
import { IProcessServiceFactory } from '../../process/types';
import { IDisposableRegistry } from '../../types';
import { IWebPanel, IWebPanelOptions, IWebPanelProvider } from '../types';
import { WebPanel } from './webPanel';

@injectable()
export class WebPanelProvider implements IWebPanelProvider {

    private port: number | undefined;

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
    }

    // tslint:disable-next-line:no-any
    public async create(options: IWebPanelOptions): Promise<IWebPanel> {
        const port = options.startHttpServer ? await this.ensureServerIsRunning() : undefined;
        return new WebPanel(this.serviceContainer.get<IDisposableRegistry>(IDisposableRegistry), port, options);
    }

    private async ensureServerIsRunning(): Promise<number> {
        if (!this.port) {
            // Compute a usable port.
            const port = await portfinder.getPortPromise({ startPort: 9000, port: 9000 });
            this.port = port;

            // Start the service. Wait for it to start before talking to it.
            try {
                const ps = await this.serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory).create();
                const server = ps.execObservable('node', [path.join(__dirname, 'webPanelServer.js'), '--port', port.toString()]);
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

        return this.port;
    }
}
