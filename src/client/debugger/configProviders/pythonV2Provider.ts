// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IPlatformService } from '../../common/platform/types';
import { IServiceContainer } from '../../ioc/types';
import { BaseConfigurationProvider, PTVSDDebugConfiguration, PythonDebugConfiguration } from './baseProvider';

@injectable()
export class PythonV2DebugConfigurationProvider extends BaseConfigurationProvider {
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super('pythonExperimental', serviceContainer);
    }
    protected provideDefaults(workspaceFolder: Uri, debugConfiguration: PythonDebugConfiguration): void {
        super.provideDefaults(workspaceFolder, debugConfiguration);

        debugConfiguration.stopOnEntry = false;

        // Add PTVSD specific flags.
        const ptvsdDebugConfigurationFlags = debugConfiguration as PTVSDDebugConfiguration;
        ptvsdDebugConfigurationFlags.redirectOutput = Array.isArray(debugConfiguration.debugOptions) && debugConfiguration.debugOptions.indexOf('RedirectOutput') >= 0;
        ptvsdDebugConfigurationFlags.fixFilePathCase = this.serviceContainer.get<IPlatformService>(IPlatformService).isWindows;
    }
}
