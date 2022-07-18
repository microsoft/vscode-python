// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Uri } from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import { IJupyterExtensionDependencyManager } from '../../common/application/types';
import { IServiceContainer } from '../../ioc/types';
import { JupyterExtensionIntegration } from '../../jupyter/jupyterIntegration';
import { traceLog } from '../../logging';
import { LanguageClientMiddleware } from '../languageClientMiddleware';
import { LspInteractiveWindowMiddlewareAddon } from './lspInteractiveWindowMiddlewareAddon';

import { LanguageServerType } from '../types';

import { LspNotebooksExperiment } from './lspNotebooksExperiment';

export class NodeLanguageClientMiddleware extends LanguageClientMiddleware {
    private readonly lspNotebooksExperiment: LspNotebooksExperiment;

    private readonly jupyterExtensionIntegration: JupyterExtensionIntegration;

    public constructor(
        serviceContainer: IServiceContainer,
        getClient: () => LanguageClient | undefined,
        serverVersion?: string,
    ) {
        super(serviceContainer, LanguageServerType.Node, getClient, serverVersion);

        this.lspNotebooksExperiment = serviceContainer.get<LspNotebooksExperiment>(LspNotebooksExperiment);
        this.setupHidingMiddleware(serviceContainer);

        this.jupyterExtensionIntegration = serviceContainer.get<JupyterExtensionIntegration>(
            JupyterExtensionIntegration,
        );
        if (!this.notebookAddon && this.lspNotebooksExperiment.isInNotebooksExperiment()) {
            this.notebookAddon = new LspInteractiveWindowMiddlewareAddon(
                this.getClient,
                this.jupyterExtensionIntegration,
            );
        }
    }

    protected shouldCreateHidingMiddleware(jupyterDependencyManager: IJupyterExtensionDependencyManager): boolean {
        return (
            super.shouldCreateHidingMiddleware(jupyterDependencyManager) &&
            !this.lspNotebooksExperiment.isInNotebooksExperiment()
        );
    }

    protected async onExtensionChange(jupyterDependencyManager: IJupyterExtensionDependencyManager): Promise<void> {
        if (jupyterDependencyManager && jupyterDependencyManager.isJupyterExtensionInstalled) {
            await this.lspNotebooksExperiment.onJupyterInstalled();
        }

        super.onExtensionChange(jupyterDependencyManager);

        if (jupyterDependencyManager && !this.notebookAddon && this.lspNotebooksExperiment.isInNotebooksExperiment()) {
            this.notebookAddon = new LspInteractiveWindowMiddlewareAddon(
                this.getClient,
                this.jupyterExtensionIntegration,
            );
        }
    }

    protected async getPythonPathOverride(uri: Uri | undefined): Promise<string | undefined> {
        if (!uri || !this.lspNotebooksExperiment.isInNotebooksExperiment()) {
            return undefined;
        }

        const jupyterPythonPathFunction = this.jupyterExtensionIntegration.getJupyterPythonPathFunction();
        if (!jupyterPythonPathFunction) {
            return undefined;
        }

        const result = await jupyterPythonPathFunction(uri);

        if (result) {
            traceLog(`Jupyter provided interpreter path override: ${result}`);
        }

        return result;
    }
}
