// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IPlatformService } from '../../common/platform/types';
import { IServiceContainer } from '../../ioc/types';
import { AttachRequestArguments, DebugOptions, LaunchRequestArguments } from '../Common/Contracts';
import { BaseConfigurationProvider, PythonAttachDebugConfiguration, PythonLaunchDebugConfiguration } from './baseProvider';
import { IConfigurationProviderUtils } from './types';

@injectable()
export class PythonV2DebugConfigurationProvider extends BaseConfigurationProvider<LaunchRequestArguments, AttachRequestArguments> {
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super('pythonExperimental', serviceContainer);
    }
    protected async provideLaunchDefaults(workspaceFolder: Uri, debugConfiguration: PythonLaunchDebugConfiguration<LaunchRequestArguments>): Promise<void> {
        await super.provideLaunchDefaults(workspaceFolder, debugConfiguration);
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
        if (debugConfiguration.redirectOutput || debugConfiguration.redirectOutput === undefined) {
            this.debugOption(debugOptions, DebugOptions.RedirectOutput);
        }
        if (debugConfiguration.sudo) {
            this.debugOption(debugOptions, DebugOptions.Sudo);
        }
        if (this.serviceContainer.get<IPlatformService>(IPlatformService).isWindows) {
            this.debugOption(debugOptions, DebugOptions.FixFilePathCase);
        }
        const isFlask = debugConfiguration.module && debugConfiguration.module.toUpperCase() === 'FLASK';
        if ((debugConfiguration.pyramid || isFlask)
            && debugOptions.indexOf(DebugOptions.Jinja) === -1
            && debugConfiguration.jinja !== false) {
            this.debugOption(debugOptions, DebugOptions.Jinja);
        }
        if (debugConfiguration.pyramid) {
            const utils = this.serviceContainer.get<IConfigurationProviderUtils>(IConfigurationProviderUtils);
            debugConfiguration.program = (await utils.getPyramidStartupScriptFilePath(workspaceFolder))!;
        }
    }
    protected async provideAttachDefaults(workspaceFolder: Uri, debugConfiguration: PythonAttachDebugConfiguration<AttachRequestArguments>): Promise<void> {
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
        const isLocalHost = !debugConfiguration.host || debugConfiguration.host === 'localhost' || debugConfiguration.host === '127.0.0.1';
        if (this.serviceContainer.get<IPlatformService>(IPlatformService).isWindows && isLocalHost) {
            this.debugOption(debugOptions, DebugOptions.FixFilePathCase);
        }
        if (this.serviceContainer.get<IPlatformService>(IPlatformService).isWindows) {
            this.debugOption(debugOptions, DebugOptions.WindowsClient);
        }

        if (!debugConfiguration.pathMappings) {
            debugConfiguration.pathMappings = [];
        }
        if (debugConfiguration.localRoot && debugConfiguration.remoteRoot) {
            debugConfiguration.pathMappings!.push({
                localRoot: debugConfiguration.localRoot,
                remoteRoot: debugConfiguration.remoteRoot
            });
        }
    }
    private debugOption(debugOptions: DebugOptions[], debugOption: DebugOptions) {
        if (debugOptions.indexOf(debugOption) >= 0) {
            return;
        }
        debugOptions.push(debugOption);
    }
}
