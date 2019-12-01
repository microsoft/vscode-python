// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import { ViewColumn } from 'vscode';

import { IServiceContainer } from '../../ioc/types';
import { IWebPanel, IWebPanelMessageListener, IWebPanelProvider } from './types';
import { WebPanel } from './webPanel';

@injectable()
export class WebPanelProvider implements IWebPanelProvider {
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
    }

    // tslint:disable-next-line:no-any
    public create(viewColumn: ViewColumn, listener: IWebPanelMessageListener, title: string, rootPath: string, scripts: string[], embeddedCss?: string, settings?: any) : IWebPanel {
        return new WebPanel(viewColumn, this.serviceContainer, listener, title, rootPath, scripts, embeddedCss, settings);
    }
}
