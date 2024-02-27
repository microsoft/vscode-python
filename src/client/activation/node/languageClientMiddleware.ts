// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Uri } from 'vscode';
import { ConfigurationItem, LSPObject } from 'vscode-languageclient/node';
import { IJupyterExtensionDependencyManager, IWorkspaceService } from '../../common/application/types';
import { IServiceContainer } from '../../ioc/types';
import { JupyterExtensionIntegration } from '../../jupyter/jupyterIntegration';
import { traceLog } from '../../logging';
import { LanguageClientMiddleware } from '../languageClientMiddleware';

import { LanguageServerType } from '../types';

export class NodeLanguageClientMiddleware extends LanguageClientMiddleware {
    private readonly jupyterExtensionIntegration: JupyterExtensionIntegration;

    private readonly workspaceService: IWorkspaceService;

    public constructor(serviceContainer: IServiceContainer, serverVersion?: string) {
        super(serviceContainer, LanguageServerType.Node, serverVersion);

        this.workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);

        this.setupHidingMiddleware(serviceContainer);

        this.jupyterExtensionIntegration = serviceContainer.get<JupyterExtensionIntegration>(
            JupyterExtensionIntegration,
        );
    }

    // eslint-disable-next-line class-methods-use-this
    protected shouldCreateHidingMiddleware(_: IJupyterExtensionDependencyManager): boolean {
        return false;
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
