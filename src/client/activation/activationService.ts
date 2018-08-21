// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ConfigurationChangeEvent, Disposable, OutputChannel, Uri } from 'vscode';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../common/application/types';
import { isLanguageServerTest, STANDARD_OUTPUT_CHANNEL } from '../common/constants';
import '../common/extensions';
import { IPlatformService, OSDistro, OSType } from '../common/platform/types';
import { IConfigurationService, IDisposableRegistry, IOutputChannel, IPythonSettings } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { PYTHON_LANGUAGE_SERVER_PLATFORM_NOT_SUPPORTED } from '../telemetry/constants';
import { getTelemetryReporter } from '../telemetry/telemetry';
import { ExtensionActivators, IExtensionActivationService, IExtensionActivator } from './types';

const jediEnabledSetting: keyof IPythonSettings = 'jediEnabled';
const LS_MIN_OS_VERSIONS: [OSType, OSDistro, string][] = [
    // See: https://code.visualstudio.com/docs/supporting/requirements
    [OSType.OSX, OSDistro.Unknown, '10.12'],  // Sierra or higher
    [OSType.Windows, OSDistro.Unknown, '6.1'],  // Win 7 or higher
    // tslint:disable-next-line: no-suspicious-comment
    // TODO: Are these right?
    [OSType.Linux, OSDistro.Ubuntu, '14.04'],  // "precise"
    [OSType.Linux, OSDistro.Debian, '7'],
    [OSType.Linux, OSDistro.RHEL, '7'],
    [OSType.Linux, OSDistro.CentOS, '7'],
    [OSType.Linux, OSDistro.Fedora, '23']
];

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
            const reporter = getTelemetryReporter();
            // tslint:disable-next-line:no-suspicious-comment
            // TODO: Only send once (ever)?
            reporter.sendTelemetryEvent(PYTHON_LANGUAGE_SERVER_PLATFORM_NOT_SUPPORTED);
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
    let minVer = '';
    for (const [osType, distro, ver] of LS_MIN_OS_VERSIONS) {
        if (platform.os.type === osType && platform.os.distro === distro) {
            minVer = ver;
            break;
        }
    }
    if (minVer === '') {
        return true;
    }
    minVer = normalizeVersion(minVer);
    return platform.os.version.compare(minVer) >= 0;
}

function normalizeVersion(ver: string): string {
    ver = ver.replace(/\.00*/, '.');
    if (/^\d\d*$/.test(ver)) {
        return `${ver}.0.0`;
    } else if (/^\d\d*\.\d\d*$/.test(ver)) {
        return `${ver}.0`;
    } else {
        return ver;
    }
}
