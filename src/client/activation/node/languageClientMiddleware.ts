// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Uri } from 'vscode';
import { ConfigurationItem, LanguageClient, LSPObject } from 'vscode-languageclient/node';
import { IJupyterExtensionDependencyManager, IWorkspaceService } from '../../common/application/types';
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

    private readonly workspaceService: IWorkspaceService;

    public constructor(
        serviceContainer: IServiceContainer,
        private getClient: () => LanguageClient | undefined,
        serverVersion?: string,
    ) {
        super(serviceContainer, LanguageServerType.Node, serverVersion);

        this.workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);

        this.lspNotebooksExperiment = serviceContainer.get<LspNotebooksExperiment>(LspNotebooksExperiment);
        this.setupHidingMiddleware(serviceContainer);

        this.jupyterExtensionIntegration = serviceContainer.get<JupyterExtensionIntegration>(
            JupyterExtensionIntegration,
        );
        if (!this.notebookAddon) {
            this.notebookAddon = new LspInteractiveWindowMiddlewareAddon(
                this.getClient,
                this.jupyterExtensionIntegration,
            );
        }
    }

    // eslint-disable-next-line class-methods-use-this
    protected shouldCreateHidingMiddleware(_: IJupyterExtensionDependencyManager): boolean {
        return false;
    }

    protected async onExtensionChange(jupyterDependencyManager: IJupyterExtensionDependencyManager): Promise<void> {
        if (jupyterDependencyManager && jupyterDependencyManager.isJupyterExtensionInstalled) {
            await this.lspNotebooksExperiment.onJupyterInstalled();
        }

        if (!this.notebookAddon) {
            this.notebookAddon = new LspInteractiveWindowMiddlewareAddon(
                this.getClient,
                this.jupyterExtensionIntegration,
            );
        }
    }

    protected async getPythonPathOverride(uri: Uri | undefined): Promise<string | undefined> {
        if (!uri) {
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

    // eslint-disable-next-line class-methods-use-this
    protected configurationHook(item: ConfigurationItem, settings: LSPObject): void {
        if (item.section === 'editor') {
            if (this.workspaceService) {
                // Get editor.formatOnType using Python language id so [python] setting
                // will be honored if present.
                const editorConfig = this.workspaceService.getConfiguration(
                    item.section,
                    undefined,
                    /* languageSpecific */ true,
                );

                const settingDict: LSPObject & { formatOnType?: boolean } = settings as LSPObject & {
                    formatOnType: boolean;
                };

                settingDict.formatOnType = editorConfig.get('formatOnType');
            }
        }
    }
}
