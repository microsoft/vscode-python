// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Uri } from 'vscode';
import { IJupyterExtensionDependencyManager } from '../../common/application/types';
import { IServiceContainer } from '../../ioc/types';
import { JupyterExtensionIntegration } from '../../jupyter/jupyterIntegration';
import { traceLog } from '../../logging';
import { LanguageClientMiddleware } from '../languageClientMiddleware';

import { LanguageServerType } from '../types';

import { LspNotebooksExperiment } from './lspNotebooksExperiment';

export class NodeLanguageClientMiddleware extends LanguageClientMiddleware {
    private readonly lspNotebooksExperiment: LspNotebooksExperiment;

    public constructor(serviceContainer: IServiceContainer, serverVersion?: string) {
        super(serviceContainer, LanguageServerType.Node, serverVersion);

        this.lspNotebooksExperiment = serviceContainer.get<LspNotebooksExperiment>(LspNotebooksExperiment);
        this.setupHidingMiddleware(serviceContainer);
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
    }

    protected async getPythonPathOverride(uri: Uri | undefined): Promise<string | undefined> {
        if (!uri || !this.lspNotebooksExperiment.isInNotebooksExperiment()) {
            return undefined;
        }

        const jupyterExtensionIntegration = this.serviceContainer?.get<JupyterExtensionIntegration>(
            JupyterExtensionIntegration,
        );
        const jupyterPythonPathFunction = jupyterExtensionIntegration?.getJupyterPythonPathFunction();
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
