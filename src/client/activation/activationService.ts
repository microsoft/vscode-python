// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ConfigurationChangeEvent, Disposable, OutputChannel, Uri } from 'vscode';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../common/application/types';
import { isLanguageServerTest, STANDARD_OUTPUT_CHANNEL } from '../common/constants';
import '../common/extensions';
import { IConfigurationService, IDisposableRegistry, IOutputChannel, IPythonSettings } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { ExtensionActivators, IExtensionActivationService, IExtensionActivator } from './types';

const jediEnabledSetting: keyof IPythonSettings = 'jediEnabled';

type ActivatorInfo = { jedi: boolean; activator: IExtensionActivator };

@injectable()
export class ExtensionActivationService implements IExtensionActivationService, Disposable {
    private currentActivator?: ActivatorInfo;
    private readonly workspaceService: IWorkspaceService;
    private readonly output: OutputChannel;
    private readonly appShell: IApplicationShell;
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        this.output = this.serviceContainer.get<OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
        this.appShell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);

        const disposables = serviceContainer.get<IDisposableRegistry>(IDisposableRegistry);
        disposables.push(this);
        disposables.push(this.workspaceService.onDidChangeConfiguration(this.onDidChangeConfiguration.bind(this)));
    }
    public async activate(): Promise<void> {
        if (this.currentActivator) {
            return;
        }

        const jedi = this.useJedi();

        const engineName = jedi ? 'Jedi Python language engine' : 'Microsoft Python language server';
        this.output.appendLine(`Starting ${engineName}.`);
        const activatorName = jedi ? ExtensionActivators.Jedi : ExtensionActivators.DotNet;
        const activator = this.serviceContainer.get<IExtensionActivator>(IExtensionActivator, activatorName);
        this.currentActivator = { jedi, activator };

        await activator.activate();
    }
    public dispose() {
        if (this.currentActivator) {
            this.currentActivator.activator.deactivate().ignoreErrors();
        }
    }
    private async onDidChangeConfiguration(event: ConfigurationChangeEvent) {
        const workspacesUris: (Uri | undefined)[] = this.workspaceService.hasWorkspaceFolders ? this.workspaceService.workspaceFolders!.map(workspace => workspace.uri) : [undefined];
        if (workspacesUris.findIndex(uri => event.affectsConfiguration(`python.${jediEnabledSetting}`, uri)) === -1) {
            return;
        }
        const jedi = this.useJedi();
        if (this.currentActivator && this.currentActivator.jedi === jedi) {
            return;
        }

        const item = await this.appShell.showInformationMessage('Please reload the window switching between language engines.', 'Reload');
        if (item === 'Reload') {
            this.serviceContainer.get<ICommandManager>(ICommandManager).executeCommand('workbench.action.reloadWindow');
        }
    }
    private useJedi(): boolean {
        const workspacesUris: (Uri | undefined)[] = this.workspaceService.hasWorkspaceFolders ? this.workspaceService.workspaceFolders!.map(item => item.uri) : [undefined];
        const configuraionService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        const jediEnabledForAnyWorkspace = workspacesUris.filter(uri => configuraionService.getSettings(uri).jediEnabled).length > 0;
        return !isLanguageServerTest() && jediEnabledForAnyWorkspace;
    }
}
