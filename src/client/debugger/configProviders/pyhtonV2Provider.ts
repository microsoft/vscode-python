// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IServiceContainer } from '../../ioc/types';
import { BaseConfigurationProvider, PythonDebugConfiguration } from './baseProvider';

@injectable()
export class PythonV2DebugConfigurationProvider extends BaseConfigurationProvider {
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super('pythonExperimental', serviceContainer);
    }
    protected provideDefaults(debugConfiguration: PythonDebugConfiguration): void {
        debugConfiguration.stopOnEntry = false;
        debugConfiguration.console = 'integratedTerminal';
    }
}
