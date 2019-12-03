// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import { ViewColumn } from 'vscode';

import { IServiceContainer } from '../../../ioc/types';
import { traceInfo } from '../../logger';
import { IProcessServiceFactory } from '../../process/types';
import { createDeferred } from '../../utils/async';
import { IWebPanel, IWebPanelMessageListener, IWebPanelProvider } from '../types';
import { WebPanel } from './webPanel';

@injectable()
export class WebPanelProvider implements IWebPanelProvider {

    private port: number | undefined;

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
    }

    // tslint:disable-next-line:no-any
    public async create(viewColumn: ViewColumn, listener: IWebPanelMessageListener, title: string, rootPath: string, scripts: string[], embeddedCss?: string, settings?: any): Promise<IWebPanel> {
        const port = await this.ensureServerIsRunning();
        return new WebPanel(viewColumn, this.serviceContainer, listener, title, rootPath, scripts, port, embeddedCss, settings);
    }

    private async ensureServerIsRunning(): Promise<number> {
        if (!this.port) {
            const procService = await this.serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory).create();
            const server = procService.execObservable('node', [path.join(__dirname, 'webPanelServer.js')], { cwd: 'D:\\Training\\SnakePython' });
            const promise = createDeferred<number>();

            // This should output the port number
            server.out.subscribe(next => {
                if (!promise.resolved) {
                    this.port = parseInt(next.out, 10);
                    promise.resolve(this.port);
                } else {
                    traceInfo(`WebServer output: ${next.out}`);
                }
            },
                error => {
                    promise.reject(error);
                },
                () => {
                    this.port = undefined;
                    promise.reject(new Error('server died'));
                });

            return promise.promise;
        }

        return Promise.resolve(this.port);
    }
}
