// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IPlatformService } from '../../../common/platform/types';
import { IServiceContainer } from '../../../ioc/types';
import { sendTelemetryEvent } from '../../../telemetry';
import { DEBUGGER } from '../../../telemetry/constants';
import { DebuggerTelemetry } from '../../../telemetry/types';
import { AttachRequestArguments, DebugOptions, LaunchRequestArguments } from '../../types';
import { BaseConfigurationProvider } from './baseProvider';
import { IConfigurationProviderUtils } from './types';

@injectable()
export class PythonV2DebugConfigurationProvider extends BaseConfigurationProvider {
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super('python', serviceContainer);
    }
    protected async provideLaunchDefaults(workspaceFolder: Uri | undefined, debugConfiguration: LaunchRequestArguments): Promise<void> {
        await super.provideLaunchDefaults(workspaceFolder, debugConfiguration);
        const debugOptions = debugConfiguration.debugOptions!;
        if (debugConfiguration.debugStdLib) {
            this.debugOption(debugOptions, DebugOptions.DebugStdLib);
        }
        if (debugConfiguration.stopOnEntry) {
            this.debugOption(debugOptions, DebugOptions.StopOnEntry);
        }
        if (debugConfiguration.showReturnValue) {
            this.debugOption(debugOptions, DebugOptions.ShowReturnValue);
        }
        if (debugConfiguration.django) {
            this.debugOption(debugOptions, DebugOptions.Django);
        }
        if (debugConfiguration.jinja) {
            this.debugOption(debugOptions, DebugOptions.Jinja);
        }
        if (debugConfiguration.redirectOutput || debugConfiguration.redirectOutput === undefined) {
            this.debugOption(debugOptions, DebugOptions.RedirectOutput);
        }
        if (debugConfiguration.sudo) {
            this.debugOption(debugOptions, DebugOptions.Sudo);
        }
        if (debugConfiguration.subProcess === true) {
            this.debugOption(debugOptions, DebugOptions.SubProcess);
        }
        if (this.serviceContainer.get<IPlatformService>(IPlatformService).isWindows) {
            this.debugOption(debugOptions, DebugOptions.FixFilePathCase);
        }
        const isFlask = this.isDebuggingFlask(debugConfiguration);
        if ((debugConfiguration.pyramid || isFlask)
            && debugOptions.indexOf(DebugOptions.Jinja) === -1
            && debugConfiguration.jinja !== false) {
            this.debugOption(debugOptions, DebugOptions.Jinja);
        }
        if (debugConfiguration.pyramid) {
            const utils = this.serviceContainer.get<IConfigurationProviderUtils>(IConfigurationProviderUtils);
            debugConfiguration.program = (await utils.getPyramidStartupScriptFilePath(workspaceFolder))!;
        }
        this.sendTelemetry('launch', debugConfiguration);
    }
    // tslint:disable-next-line:cyclomatic-complexity
    protected async provideAttachDefaults(workspaceFolder: Uri | undefined, debugConfiguration: AttachRequestArguments): Promise<void> {
        await super.provideAttachDefaults(workspaceFolder, debugConfiguration);
        const debugOptions = debugConfiguration.debugOptions!;
        if (debugConfiguration.debugStdLib) {
            this.debugOption(debugOptions, DebugOptions.DebugStdLib);
        }
        if (debugConfiguration.django) {
            this.debugOption(debugOptions, DebugOptions.Django);
        }
        if (debugConfiguration.jinja) {
            this.debugOption(debugOptions, DebugOptions.Jinja);
        }
        if (debugConfiguration.subProcess === true) {
            this.debugOption(debugOptions, DebugOptions.SubProcess);
        }
        if (debugConfiguration.pyramid
            && debugOptions.indexOf(DebugOptions.Jinja) === -1
            && debugConfiguration.jinja !== false) {
            this.debugOption(debugOptions, DebugOptions.Jinja);
        }
        if (debugConfiguration.redirectOutput || debugConfiguration.redirectOutput === undefined) {
            this.debugOption(debugOptions, DebugOptions.RedirectOutput);
        }

        // We'll need paths to be fixed only in the case where local and remote hosts are the same
        // I.e. only if hostName === 'localhost' or '127.0.0.1' or ''
        const isLocalHost = this.isLocalHost(debugConfiguration.host);
        if (this.serviceContainer.get<IPlatformService>(IPlatformService).isWindows && isLocalHost) {
            this.debugOption(debugOptions, DebugOptions.FixFilePathCase);
        }
        if (this.serviceContainer.get<IPlatformService>(IPlatformService).isWindows) {
            this.debugOption(debugOptions, DebugOptions.WindowsClient);
        } else {
            this.debugOption(debugOptions, DebugOptions.UnixClient);
        }

        if (!debugConfiguration.pathMappings) {
            debugConfiguration.pathMappings = [];
        }
        // This is for backwards compatibility.
        if (debugConfiguration.localRoot && debugConfiguration.remoteRoot) {
            debugConfiguration.pathMappings!.push({
                localRoot: debugConfiguration.localRoot,
                remoteRoot: debugConfiguration.remoteRoot
            });
        }
        // If attaching to local host, then always map local root and remote roots.
        if (workspaceFolder && debugConfiguration.host &&
            debugConfiguration.pathMappings!.length === 0 &&
            ['LOCALHOST', '127.0.0.1', '::1'].indexOf(debugConfiguration.host.toUpperCase()) >= 0) {
            debugConfiguration.pathMappings!.push({
                localRoot: workspaceFolder.fsPath,
                remoteRoot: workspaceFolder.fsPath
            });
        }
        this.sendTelemetry('attach', debugConfiguration);
    }
    private debugOption(debugOptions: DebugOptions[], debugOption: DebugOptions) {
        if (debugOptions.indexOf(debugOption) >= 0) {
            return;
        }
        debugOptions.push(debugOption);
    }
    private isLocalHost(hostName?: string) {
        const LocalHosts = ['localhost', '127.0.0.1', '::1'];
        return (hostName && LocalHosts.indexOf(hostName.toLowerCase()) >= 0) ? true : false;
    }
    private isDebuggingFlask(debugConfiguration: Partial<LaunchRequestArguments & AttachRequestArguments>) {
        return (debugConfiguration.module && debugConfiguration.module.toUpperCase() === 'FLASK') ? true : false;
    }
    private sendTelemetry(trigger: 'launch' | 'attach', debugConfiguration: Partial<LaunchRequestArguments & AttachRequestArguments>) {
        const telemetryProps: DebuggerTelemetry = {
            trigger,
            console: debugConfiguration.console,
            hasEnvVars: typeof debugConfiguration.env === 'object' && Object.keys(debugConfiguration.env).length > 0,
            django: !!debugConfiguration.django,
            flask: this.isDebuggingFlask(debugConfiguration),
            hasArgs: Array.isArray(debugConfiguration.args) && debugConfiguration.args.length > 0,
            isLocalhost: this.isLocalHost(debugConfiguration.host),
            isModule: typeof debugConfiguration.module === 'string' && debugConfiguration.module.length > 0,
            isSudo: !!debugConfiguration.sudo,
            jinja: !!debugConfiguration.jinja,
            pyramid: !!debugConfiguration.pyramid,
            stopOnEntry: !!debugConfiguration.stopOnEntry,
            showReturnValue: !!debugConfiguration.showReturnValue,
            subProcess: !!debugConfiguration.subProcess
        };
        sendTelemetryEvent(DEBUGGER, undefined, telemetryProps);
    }
}
