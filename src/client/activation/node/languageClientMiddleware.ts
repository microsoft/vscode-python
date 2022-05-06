// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { createHidingMiddleware } from '@vscode/jupyter-lsp-middleware';
import { Uri } from 'vscode';
import { localize } from 'vscode-nls';
import { IJupyterExtensionDependencyManager } from '../../common/application/types';
import { IDisposableRegistry, IExtensions } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { traceLog } from '../../logging';
import { sendTelemetryEvent } from '../../telemetry';

import { LanguageClientMiddlewareBase } from '../languageClientMiddlewareBase';
import { LanguageServerType } from '../types';

import { LspNotebooksExperiment } from './lspNotebooksExperiment';

export class NodeLanguageClientMiddleware extends LanguageClientMiddlewareBase {
    private readonly lspNotebooksExperiment: LspNotebooksExperiment;

    private jupyterPythonPathFunction: ((uri: Uri) => Promise<string | undefined>) | undefined = undefined;

    public constructor(serviceContainer: IServiceContainer, serverVersion?: string) {
        super(serviceContainer, LanguageServerType.Node, sendTelemetryEvent, serverVersion);

        this.lspNotebooksExperiment = serviceContainer.get<LspNotebooksExperiment>(LspNotebooksExperiment);

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
            extensions?.onDidChange(async () => {
                if (jupyterDependencyManager) {
                    if (jupyterDependencyManager.isJupyterExtensionInstalled) {
                        await this.lspNotebooksExperiment.onJupyterInstalled();
                    }

                    if (
                        this.notebookAddon &&
                        (!jupyterDependencyManager.isJupyterExtensionInstalled ||
                            this.lspNotebooksExperiment.isInNotebooksExperiment())
                    ) {
                        this.notebookAddon = undefined;
                    } else if (
                        !this.notebookAddon &&
                        jupyterDependencyManager.isJupyterExtensionInstalled &&
                        !this.lspNotebooksExperiment.isInNotebooksExperiment()
                    ) {
                        this.notebookAddon = createHidingMiddleware();
                    }
                }
            }),
        );
    }

    public registerJupyterPythonPathFunction(func: (uri: Uri) => Promise<string | undefined>): void {
        this.jupyterPythonPathFunction = func;
    }

    protected async getPythonPathOverride(uri: Uri | undefined): Promise<string | undefined> {
        if (!uri || !this.jupyterPythonPathFunction || !this.lspNotebooksExperiment.isInNotebooksExperiment()) {
            return undefined;
        }

        const result = await this.jupyterPythonPathFunction(uri);

        if (result) {
            traceLog(
                localize(
                    'Interpreters.pythonInterpreterPathFromJupyter',
                    'Jupyter provided interpreter path override: {0}',
                    result,
                ),
            );
        }

        return result;
    }
}
