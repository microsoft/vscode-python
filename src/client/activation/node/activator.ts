// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { CancellationToken, CompletionItem, ProviderResult } from 'vscode';

import ProtocolCompletionItem from 'vscode-languageclient/lib/common/protocolCompletionItem';
import { CompletionResolveRequest } from 'vscode-languageclient/node';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../../common/application/types';
import { PYLANCE_EXTENSION_ID } from '../../common/constants';
import { IFileSystem } from '../../common/platform/types';
import { IConfigurationService, IExtensions, Resource } from '../../common/types';
import { Pylance } from '../../common/utils/localize';
import { LanguageServerActivatorBase } from '../common/activatorBase';
import { promptForPylanceInstall } from '../common/languageServerChangeHandler';
import { ILanguageServerManager } from '../types';

/**
 * Starts Pylance language server manager.
 *
 * @export
 * @class NodeLanguageServerActivator
 * @implements {ILanguageServerActivator}
 * @extends {LanguageServerActivatorBase}
 */
@injectable()
export class NodeLanguageServerActivator extends LanguageServerActivatorBase {
    constructor(
        @inject(ILanguageServerManager) manager: ILanguageServerManager,
        @inject(IWorkspaceService) workspace: IWorkspaceService,
        @inject(IFileSystem) fs: IFileSystem,
        @inject(IConfigurationService) configurationService: IConfigurationService,
        @inject(IExtensions) private readonly extensions: IExtensions,
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
        @inject(ICommandManager) readonly commandManager: ICommandManager,
    ) {
        super(manager, workspace, fs, configurationService);
    }

    public async ensureLanguageServerIsAvailable(resource: Resource): Promise<void> {
        const settings = this.configurationService.getSettings(resource);
        if (settings.downloadLanguageServer === false) {
            // Development mode.
            return;
        }
        if (!this.extensions.getExtension(PYLANCE_EXTENSION_ID)) {
            // Pylance is not yet installed. Throw will cause activator to use Jedi
            // temporarily. Language server installation tracker will prompt for window
            // reload when Pylance becomes available.
            await promptForPylanceInstall(
                this.appShell,
                this.commandManager,
                this.workspace,
                this.configurationService,
            );
            throw new Error(Pylance.pylanceNotInstalledMessage());
        }
    }

    public resolveCompletionItem(item: CompletionItem, token: CancellationToken): ProviderResult<CompletionItem> {
        return this.handleResolveCompletionItem(item, token);
    }

    private async handleResolveCompletionItem(
        item: CompletionItem,
        token: CancellationToken,
    ): Promise<CompletionItem | undefined> {
        const languageClient = this.getLanguageClient();

        if (languageClient) {
            // Turn our item into a ProtocolCompletionItem before we convert it. This preserves the .data
            // attribute that it has and is needed to match on the language server side.
            const protoItem: ProtocolCompletionItem = new ProtocolCompletionItem(
                typeof item.label === 'string' ? item.label : item.label.label,
            );
            Object.assign(protoItem, item);

            const args = languageClient.code2ProtocolConverter.asCompletionItem(protoItem);
            const result = await languageClient.sendRequest(CompletionResolveRequest.type, args, token);

            if (result) {
                return languageClient.protocol2CodeConverter.asCompletionItem(result);
            }
        }
    }
}
