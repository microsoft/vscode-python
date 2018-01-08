// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { IServiceManager } from '../../ioc/types';
import { IInstaller } from '../types';
import { CondaInstaller } from './condaInstaller';
import { Installer } from './installer';
import { PipInstaller } from './pipInstaller';
import { IModuleInstaller, IPythonInstallation } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IModuleInstaller>(IModuleInstaller, CondaInstaller);
    serviceManager.addSingleton<IModuleInstaller>(IModuleInstaller, PipInstaller);
}
