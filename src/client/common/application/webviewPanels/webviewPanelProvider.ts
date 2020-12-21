// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { IFileSystem } from '../../platform/types';
import { IDisposableRegistry, IExtensionContext } from '../../types';
import { IWebviewPanel, IWebviewPanelOptions, IWebviewPanelProvider } from '../types';
import { WebviewPanel } from './webviewPanel';

@injectable()
export class WebviewPanelProvider implements IWebviewPanelProvider {
    constructor(
        @inject(IDisposableRegistry) private readonly disposableRegistry: IDisposableRegistry,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(IExtensionContext) private readonly context: IExtensionContext,
    ) {}

    // tslint:disable-next-line:no-any
    public async create(options: IWebviewPanelOptions): Promise<IWebviewPanel> {
        // Allow loading resources from the `<extension folder>/tmp` folder when in webiviews.
        // Used by widgets to place files that are not otherwise accessible.
        const additionalRootPaths = [Uri.file(path.join(this.context.extensionPath, 'tmp'))];
        if (Array.isArray(options.additionalPaths)) {
            additionalRootPaths.push(...options.additionalPaths.map((item) => Uri.file(item)));
        }
        return new WebviewPanel(this.fs, this.disposableRegistry, options, additionalRootPaths);
    }
}
