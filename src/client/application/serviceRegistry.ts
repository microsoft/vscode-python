// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IServiceManager } from '../ioc/types';
import { ApplicationDiagnostics } from './diagnostics/applicationDiagnostics';
import { registerTypes as diagnosticsRegisterTypes } from './diagnostics/serviceRegistry';
import { SourceMapSupportService } from './diagnostics/surceMapSupportService';
import { ISourceMapSupportService } from './diagnostics/types';
import { IApplicationDiagnostics } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IApplicationDiagnostics>(IApplicationDiagnostics, ApplicationDiagnostics);
    serviceManager.addSingleton<ISourceMapSupportService>(ISourceMapSupportService, SourceMapSupportService);
    diagnosticsRegisterTypes(serviceManager);
}
