// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IPlatformService } from '../../common/platform/types';
import { IServiceContainer } from '../../ioc/types';
import { DebugOptions } from '../Common/Contracts';
import { BaseConfigurationProvider, PythonAttachDebugConfiguration, PythonLaunchDebugConfiguration } from './baseProvider';

@injectable()
export class PythonV2DebugConfigurationProvider extends BaseConfigurationProvider {
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super('pythonExperimental', serviceContainer);
    }
    protected provideLaunchDefaults(workspaceFolder: Uri, debugConfiguration: PythonLaunchDebugConfiguration): void {
        super.provideLaunchDefaults(workspaceFolder, debugConfiguration);

        debugConfiguration.stopOnEntry = false;
        debugConfiguration.debugOptions = Array.isArray(debugConfiguration.debugOptions) ? debugConfiguration.debugOptions : [];

        // Add PTVSD specific flags.
        if (this.serviceContainer.get<IPlatformService>(IPlatformService).isWindows) {
            debugConfiguration.debugOptions.push(DebugOptions.FixFilePathCase);
        }
        if (debugConfiguration.module && debugConfiguration.module.toUpperCase() === 'FLASK'
            && debugConfiguration.debugOptions.indexOf(DebugOptions.Jinja) === -1) {
            debugConfiguration.debugOptions.push(DebugOptions.Jinja);
        }
    }
    protected provideAttachDefaults(workspaceFolder: Uri, debugConfiguration: PythonAttachDebugConfiguration): void {
        super.provideAttachDefaults(workspaceFolder, debugConfiguration);

        debugConfiguration.debugOptions = Array.isArray(debugConfiguration.debugOptions) ? debugConfiguration.debugOptions : [];

        // We'll need paths to be fixed only in the case where local and remote hosts are the same
        // I.e. only if hostName === 'localhost' or '127.0.0.1' or ''
        const isLocalHost = !debugConfiguration.host || debugConfiguration.host === 'localhost' || debugConfiguration.host === '127.0.0.1';
        if (this.serviceContainer.get<IPlatformService>(IPlatformService).isWindows && isLocalHost) {
            debugConfiguration.debugOptions.push(DebugOptions.FixFilePathCase);
        }
        if (this.serviceContainer.get<IPlatformService>(IPlatformService).isWindows) {
            debugConfiguration.debugOptions.push(DebugOptions.WindowsClient);
        }

        if (!debugConfiguration.pathMappings) {
            debugConfiguration.pathMappings = [];
        }
        debugConfiguration.pathMappings!.push({
            localRoot: debugConfiguration.localRoot,
            remoteRoot: debugConfiguration.remoteRoot
        });
    }
}
