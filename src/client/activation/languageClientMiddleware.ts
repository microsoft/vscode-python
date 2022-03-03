// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IJupyterExtensionDependencyManager } from '../common/application/types';
import { IDisposableRegistry, IExtensions } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { sendTelemetryEvent } from '../telemetry';

import { LanguageClientMiddlewareBase } from './languageClientMiddlewareBase';
import { LanguageServerType } from './types';

import { createHidingMiddleware } from '@vscode/jupyter-lsp-middleware';

export class LanguageClientMiddleware extends LanguageClientMiddlewareBase {
    public constructor(serviceContainer: IServiceContainer, serverType: LanguageServerType, serverVersion?: string) {
        super(serviceContainer, serverType, sendTelemetryEvent, serverVersion);

        if (serverType === LanguageServerType.None) {
            return;
        }

        const jupyterDependencyManager = serviceContainer.get<IJupyterExtensionDependencyManager>(
            IJupyterExtensionDependencyManager,
        );
        const disposables = serviceContainer.get<IDisposableRegistry>(IDisposableRegistry) || [];
        const extensions = serviceContainer.get<IExtensions>(IExtensions);

        // Enable notebook support if jupyter support is installed
        if (jupyterDependencyManager && jupyterDependencyManager.isJupyterExtensionInstalled) {
            this.notebookAddon = createHidingMiddleware();
        }
        disposables.push(
            extensions?.onDidChange(() => {
                if (jupyterDependencyManager) {
                    if (this.notebookAddon && !jupyterDependencyManager.isJupyterExtensionInstalled) {
                        this.notebookAddon = undefined;
                    } else if (!this.notebookAddon && jupyterDependencyManager.isJupyterExtensionInstalled) {
                        this.notebookAddon = createHidingMiddleware();
                    }
                }
            }),
        );
    }
}
