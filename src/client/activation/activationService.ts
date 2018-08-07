// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as semver from 'semver';
import { ConfigurationChangeEvent, Disposable, OutputChannel, Uri } from 'vscode';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../common/application/types';
import { isLanguageServerTest, STANDARD_OUTPUT_CHANNEL } from '../common/constants';
import '../common/extensions';
import { IPlatformService, OSType } from '../common/platform/types';
import { IConfigurationService, IDisposableRegistry, IOutputChannel, IPythonSettings } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { ExtensionActivators, IExtensionActivationService, IExtensionActivator } from './types';

const jediEnabledSetting: keyof IPythonSettings = 'jediEnabled';
const LS_MIN_OS_VERSIONS: Map<OSType, string> = new Map([
    [OSType.OSX, '10.11.0']
]);

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

        let jedi = this.useJedi();
        if (!jedi && !isLSSupported(this.serviceContainer)) {
            this.appShell.showWarningMessage('The Python Language Server is not supported on your platform.');
            jedi = true;
        }

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
        if (isLanguageServerTest()) {
            return false;
        }
        const workspacesUris: (Uri | undefined)[] = this.workspaceService.hasWorkspaceFolders ? this.workspaceService.workspaceFolders!.map(item => item.uri) : [undefined];
        const configuraionService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        return workspacesUris.filter(uri => configuraionService.getSettings(uri).jediEnabled).length > 0;
    }
}

function isLSSupported(services: IServiceContainer): boolean {
    const platform = services.get<IPlatformService>(IPlatformService);
    const minVer = LS_MIN_OS_VERSIONS[platform.osType];
    if (minVer === undefined || minVer === null) {
        return true;
    }
    if (platform.osVersion === '') {
        return false;
    }
    return semver.gt(platform.osVersion, minVer);
}
