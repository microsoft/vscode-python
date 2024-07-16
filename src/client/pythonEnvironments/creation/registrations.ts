// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IDisposableRegistry, IInterpreterPathService, IPathUtils } from '../../common/types';
import { IInterpreterQuickPick } from '../../interpreter/configuration/types';
import { IInterpreterService } from '../../interpreter/contracts';
import { registerCreateEnvironmentFeatures } from './createEnvApi';
import { registerCreateEnvironmentButtonFeatures } from './createEnvButtonContext';
import { registerTriggerForPipInTerminal } from './globalPipInTerminalTrigger';
import { registerInstalledPackagesDiagnosticsProvider } from './installedPackagesDiagnostic';
import { registerPyProjectTomlFeatures } from './pyProjectTomlContext';

export function registerAllCreateEnvironmentFeatures(
    disposables: IDisposableRegistry,
    interpreterQuickPick: IInterpreterQuickPick,
    interpreterPathService: IInterpreterPathService,
    interpreterService: IInterpreterService,
    pathUtils: IPathUtils,
): void {
    registerCreateEnvironmentFeatures(disposables, interpreterQuickPick, interpreterPathService, pathUtils);
    registerCreateEnvironmentButtonFeatures(disposables);
    registerPyProjectTomlFeatures(disposables);
    registerInstalledPackagesDiagnosticsProvider(disposables, interpreterService);
    registerTriggerForPipInTerminal(disposables);
}
