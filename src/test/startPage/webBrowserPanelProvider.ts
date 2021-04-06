// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import { IWebviewPanel, IWebviewPanelOptions, IWebviewPanelProvider } from '../../client/common/application/types';
import { IDisposableRegistry } from '../../client/common/types';
import { WebBrowserPanel } from './webBrowserPanel';

@injectable()
export class WebBrowserPanelProvider implements IWebviewPanelProvider {
    constructor(@inject(IDisposableRegistry) private disposableRegistry: IDisposableRegistry) {}

    public async create(options: IWebviewPanelOptions): Promise<IWebviewPanel> {
        return new WebBrowserPanel(this.disposableRegistry, options);
    }
}
