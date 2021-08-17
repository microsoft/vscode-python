// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import NotebookMiddlewareAddon from 'vscode-jupyter-lsp-middleware';
import { LanguageClient } from 'vscode-languageclient/node';
import { IJupyterExtensionDependencyManager, IVSCodeNotebook } from '../common/application/types';
import { PYTHON_LANGUAGE } from '../common/constants';
import { traceInfo } from '../common/logger';
import { IFileSystem } from '../common/platform/types';
import { IDisposableRegistry, IExtensions } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { sendTelemetryEvent } from '../telemetry';

import { LanguageClientMiddlewareBase } from './languageClientMiddlewareBase';
import { LanguageServerType } from './types';

export class LanguageClientMiddleware extends LanguageClientMiddlewareBase {
    public constructor(
        serviceContainer: IServiceContainer,
        serverType: LanguageServerType,
        getClient: () => LanguageClient | undefined,
        serverVersion?: string,
    ) {
        super(serviceContainer, serverType, sendTelemetryEvent, serverVersion);

        if (serverType === LanguageServerType.None || serverType === LanguageServerType.Jedi) {
            return;
        }

        const jupyterDependencyManager = serviceContainer.get<IJupyterExtensionDependencyManager>(
            IJupyterExtensionDependencyManager,
        );
        const notebookApi = serviceContainer.get<IVSCodeNotebook>(IVSCodeNotebook);
        const disposables = serviceContainer.get<IDisposableRegistry>(IDisposableRegistry) || [];
        const extensions = serviceContainer.get<IExtensions>(IExtensions);
        const fileSystem = serviceContainer.get<IFileSystem>(IFileSystem);

        // Enable notebook support if jupyter support is installed
        if (jupyterDependencyManager && jupyterDependencyManager.isJupyterExtensionInstalled) {
            this.notebookAddon = new NotebookMiddlewareAddon(
                notebookApi,
                getClient,
                traceInfo,
                fileSystem,
                PYTHON_LANGUAGE,
                /.*\.(ipynb|interactive)/m,
            );
        }
        disposables.push(
            extensions?.onDidChange(() => {
                if (jupyterDependencyManager) {
                    if (this.notebookAddon && !jupyterDependencyManager.isJupyterExtensionInstalled) {
                        this.notebookAddon = undefined;
                    } else if (!this.notebookAddon && jupyterDependencyManager.isJupyterExtensionInstalled) {
                        this.notebookAddon = new NotebookMiddlewareAddon(
                            notebookApi,
                            getClient,
                            traceInfo,
                            fileSystem,
                            PYTHON_LANGUAGE,
                            /.*\.(ipynb|interactive)/m,
                        );
                    }
                }
            }),
        );
    }
}
