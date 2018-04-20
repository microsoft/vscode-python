// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IServiceContainer } from '../../ioc/types';
import { AttachRequestArgumentsV1, DebugOptions, LaunchRequestArgumentsV1 } from '../Common/Contracts';
import { BaseConfigurationProvider, PythonAttachDebugConfiguration } from './baseProvider';

@injectable()
export class PythonDebugConfigurationProvider extends BaseConfigurationProvider<LaunchRequestArgumentsV1, AttachRequestArgumentsV1> {
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super('python', serviceContainer);
    }
    protected provideAttachDefaults(workspaceFolder: Uri | undefined, debugConfiguration: PythonAttachDebugConfiguration<AttachRequestArgumentsV1>): void {
        super.provideAttachDefaults(workspaceFolder, debugConfiguration);
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
