// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IServiceContainer } from '../../ioc/types';
import { AttachRequestArgumentsV1, DebugOptions, LaunchRequestArgumentsV1 } from '../Common/Contracts';
import { BaseConfigurationProvider, PythonAttachDebugConfiguration, PythonLaunchDebugConfiguration } from './baseProvider';
import { IConfigurationProviderUtils } from './types';

@injectable()
export class PythonDebugConfigurationProvider extends BaseConfigurationProvider<LaunchRequestArgumentsV1, AttachRequestArgumentsV1> {
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super('python', serviceContainer);
    }
    protected async provideLaunchDefaults(workspaceFolder: Uri, debugConfiguration: PythonLaunchDebugConfiguration<LaunchRequestArgumentsV1>): Promise<void> {
        await super.provideLaunchDefaults(workspaceFolder, debugConfiguration);
        // Always redirect output.
        if (debugConfiguration.debugOptions!.indexOf(DebugOptions.RedirectOutput) === -1) {
            debugConfiguration.debugOptions!.push(DebugOptions.RedirectOutput);
        }
        if (debugConfiguration.debugOptions!.indexOf(DebugOptions.Pyramid) >= 0) {
            const utils = this.serviceContainer.get<IConfigurationProviderUtils>(IConfigurationProviderUtils);
            debugConfiguration.program = (await utils.getPyramidStartupScriptFilePath(workspaceFolder))!;
        }
    }
    protected async provideAttachDefaults(workspaceFolder: Uri | undefined, debugConfiguration: PythonAttachDebugConfiguration<AttachRequestArgumentsV1>): Promise<void> {
        await super.provideAttachDefaults(workspaceFolder, debugConfiguration);
        const debugOptions = debugConfiguration.debugOptions!;
        // Always redirect output.
        if (debugOptions.indexOf(DebugOptions.RedirectOutput) === -1) {
            debugOptions.push(DebugOptions.RedirectOutput);
        }
        if (!debugConfiguration.localRoot && workspaceFolder) {
            debugConfiguration.localRoot = workspaceFolder.fsPath;
        }
    }
}
