// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IServiceContainer } from '../../ioc/types';
import { BaseConfigurationProvider, PythonDebugConfiguration } from './baseProvider';

@injectable()
export class PythonV2DebugConfigurationProvider extends BaseConfigurationProvider {
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super('pythonExperimental', serviceContainer);
    }
    protected provideDefaults(workspaceFolder: Uri, debugConfiguration: PythonDebugConfiguration): void {
        super.provideDefaults(workspaceFolder, debugConfiguration);
        debugConfiguration.stopOnEntry = false;
        if (debugConfiguration.console !== 'externalTerminal' && debugConfiguration.console !== 'integratedTerminal') {
            debugConfiguration.console = 'integratedTerminal';
        }
    }
}
