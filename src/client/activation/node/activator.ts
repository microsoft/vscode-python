// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable } from 'inversify';
import { CancellationToken, CompletionItem, ProviderResult } from 'vscode';
// tslint:disable-next-line: import-name
import ProtocolCompletionItem from 'vscode-languageclient/lib/common/protocolCompletionItem';
import { CompletionResolveRequest } from 'vscode-languageclient/node';
import {
    IApplicationEnvironment,
    IApplicationShell,
    ICommandManager,
    IWorkspaceService
} from '../../common/application/types';
import { PYLANCE_EXTENSION_ID } from '../../common/constants';
import { IFileSystem } from '../../common/platform/types';
import { IConfigurationService, IExtensions, Resource } from '../../common/types';
import { createDeferred } from '../../common/utils/async';
import { Common, Pylance } from '../../common/utils/localize';
import { getPylanceExtensionUri } from '../../languageServices/proposeLanguageServerBanner';
import { LanguageServerActivatorBase } from '../common/activatorBase';
import { ILanguageServerManager } from '../types';

/**
 * Starts the Node.js-based language server managers per workspaces (currently one for first workspace).
 *
 * @export
 * @class NodeLanguageServerActivator
 * @implements {ILanguageServerActivator}
 * @extends {LanguageServerActivatorBase}
 */
@injectable()
export class NodeLanguageServerActivator extends LanguageServerActivatorBase {
    private readonly pylanceInstallCompletedDeferred = createDeferred<void>(); // For tests to track Pylance install completion.
    private pylanceInstalled = false;

    constructor(
        @inject(ILanguageServerManager) manager: ILanguageServerManager,
        @inject(IWorkspaceService) workspace: IWorkspaceService,
        @inject(IFileSystem) fs: IFileSystem,
        @inject(IConfigurationService) configurationService: IConfigurationService,
        @inject(IExtensions) private readonly extensions: IExtensions,
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
        @inject(IApplicationEnvironment) private readonly appEnv: IApplicationEnvironment,
        @inject(ICommandManager) private readonly commands: ICommandManager
    ) {
        super(manager, workspace, fs, configurationService);
    }

    get pylanceInstallCompleted(): Promise<void> {
        return this.pylanceInstallCompletedDeferred.promise;
    }

    public async ensureLanguageServerIsAvailable(resource: Resource): Promise<void> {
        const settings = this.configurationService.getSettings(resource);
        if (settings.downloadLanguageServer === false) {
            // Development mode.
            return;
        }
        // Check if Pylance extension is installed.
        if (this.extensions.getExtension(PYLANCE_EXTENSION_ID)) {
            return;
        }
        // Point user to Pylance at the store.
        let response = await this.appShell.showErrorMessage(
            Pylance.installPylanceMessage(),
            Common.bannerLabelYes(),
            Common.bannerLabelNo()
        );
        if (response === Common.bannerLabelYes()) {
            this.appShell.openUrl(getPylanceExtensionUri(this.appEnv));
        }

        this.extensions.onDidChange(async () => {
            if (this.extensions.getExtension(PYLANCE_EXTENSION_ID) && !this.pylanceInstalled) {
                this.pylanceInstalled = true;
                response = await this.appShell.showWarningMessage(
                    Pylance.pylanceInstalledReloadPromptMessage(),
                    Common.bannerLabelYes(),
                    Common.bannerLabelNo()
                );
                this.pylanceInstallCompletedDeferred.resolve();
                if (response === Common.bannerLabelYes()) {
                    this.commands.executeCommand('workbench.action.reloadWindow');
                }
            }
        });

        // At this time there is no Pylance installed yet.
        // throwing will cause activator to use Jedi temporarily.
        throw new Error(Pylance.pylanceNotInstalledMessage());
    }

    public resolveCompletionItem(item: CompletionItem, token: CancellationToken): ProviderResult<CompletionItem> {
        return this.handleResolveCompletionItem(item, token);
    }

    private async handleResolveCompletionItem(
        item: CompletionItem,
        token: CancellationToken
    ): Promise<CompletionItem | undefined> {
        const languageClient = this.getLanguageClient();

        if (languageClient) {
            // Turn our item into a ProtocolCompletionItem before we convert it. This preserves the .data
            // attribute that it has and is needed to match on the language server side.
            const protoItem: ProtocolCompletionItem = new ProtocolCompletionItem(item.label);
            Object.assign(protoItem, item);

            const args = languageClient.code2ProtocolConverter.asCompletionItem(protoItem);
            const result = await languageClient.sendRequest(CompletionResolveRequest.type, args, token);

            if (result) {
                return languageClient.protocol2CodeConverter.asCompletionItem(result);
            }
        }
    }
}
