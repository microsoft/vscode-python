// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import * as portfinder from 'portfinder';
import * as uuid from 'uuid/v4';

import { IDisposableRegistry } from '../../types';
import { IWebPanel, IWebPanelOptions, IWebPanelProvider } from '../types';
import { WebPanel } from './webPanel';
import { WebPanelServer } from './webPanelServer';

@injectable()
export class WebPanelProvider implements IWebPanelProvider {

    private port: number | undefined;
    private token: string | undefined;

    constructor(@inject(IDisposableRegistry) private disposableRegistry: IDisposableRegistry) {
    }

    // tslint:disable-next-line:no-any
    public async create(options: IWebPanelOptions): Promise<IWebPanel> {
        const serverData = options.startHttpServer ? await this.ensureServerIsRunning() : { port: undefined, token: undefined };
        return new WebPanel(this.disposableRegistry, serverData.port, serverData.token, options);
    }

    private async ensureServerIsRunning(): Promise<{ port: number; token: string }> {
        if (!this.port || !this.token) {
            // Compute a usable port.
            this.port = await portfinder.getPortPromise({ startPort: 9000, port: 9000 });
            this.token = uuid();

            // Start the server listening.
            const webPanelServer = new WebPanelServer(this.port, this.token);
            webPanelServer.start();
            this.disposableRegistry.push(webPanelServer);
        }

        return { port: this.port, token: this.token };
    }
}
