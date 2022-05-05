// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { createHidingMiddleware } from '@vscode/jupyter-lsp-middleware';
import { Uri } from 'vscode';
import { IJupyterExtensionDependencyManager } from '../../common/application/types';
import { IConfigurationService, IDisposableRegistry, IExtensions } from '../../common/types';
import { Interpreters } from '../../common/utils/localize';
import { IServiceContainer } from '../../ioc/types';
import { traceLog } from '../../logging';
import { sendTelemetryEvent } from '../../telemetry';

import { LanguageClientMiddlewareBase } from '../languageClientMiddlewareBase';
import { LanguageServerType } from '../types';

import { LspNotebooksExperiment } from './lspNotebooksExperiment';

export class NodeLanguageClientMiddleware extends LanguageClientMiddlewareBase {
    private readonly _jupyterDependencyManager: IJupyterExtensionDependencyManager;

    private readonly _disposables: IDisposableRegistry;

    private readonly _lspNotebooksExperiment: LspNotebooksExperiment;

    private _jupyterPythonPathFunction: ((uri: Uri) => Promise<string | undefined>) | undefined = undefined;

    public constructor(serviceContainer: IServiceContainer, serverVersion?: string) {
        super(serviceContainer, LanguageServerType.Node, sendTelemetryEvent, serverVersion);

        this._jupyterDependencyManager = serviceContainer.get<IJupyterExtensionDependencyManager>(
            IJupyterExtensionDependencyManager,
        );
        this._disposables = serviceContainer.get<IDisposableRegistry>(IDisposableRegistry) || [];
        this._lspNotebooksExperiment = serviceContainer.get<LspNotebooksExperiment>(LspNotebooksExperiment);

        const extensions = serviceContainer.get<IExtensions>(IExtensions);
        const config = serviceContainer.get<IConfigurationService>(IConfigurationService);

        this._updateHidingMiddleware();

        this._disposables.push(extensions?.onDidChange(() => this._updateHidingMiddleware()));
        this._disposables.push(config.getSettings()?.onDidChange(() => this._updateHidingMiddleware()));
    }

    private _updateHidingMiddleware() {
        // Enable notebook support if jupyter support is installed
        if (this._jupyterDependencyManager) {
            if (
                this.notebookAddon &&
                (!this._jupyterDependencyManager.isJupyterExtensionInstalled ||
                    this._lspNotebooksExperiment.isInNotebooksExperiment() === true)
            ) {
                this.notebookAddon = undefined;
            } else if (
                !this.notebookAddon &&
                this._jupyterDependencyManager.isJupyterExtensionInstalled &&
                this._lspNotebooksExperiment.isInNotebooksExperiment() !== true
            ) {
                this.notebookAddon = createHidingMiddleware();
            }
        }
    }

    public registerJupyterPythonPathFunction(func: (uri: Uri) => Promise<string | undefined>): void {
        this._jupyterPythonPathFunction = func;
    }

    protected async getPythonPathOverride(uri: Uri | undefined): Promise<string | undefined> {
        if (
            uri === undefined ||
            this._jupyterPythonPathFunction === undefined ||
            this._lspNotebooksExperiment.isInNotebooksExperiment() !== true
        ) {
            return undefined;
        }

        const result = await this._jupyterPythonPathFunction(uri);

        if (result) {
            traceLog(Interpreters.pythonInterpreterPathFromJupyter().format(result));
        }

        return result;
    }
}
