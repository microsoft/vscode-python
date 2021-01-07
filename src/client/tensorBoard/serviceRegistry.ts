// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IExtensionSingleActivationService } from '../activation/types';
import { IServiceManager } from '../ioc/types';
import { TensorBoardCodeActionProvider } from './tensorBoardCodeActionProvider';
import { TensorBoardImportCodeLensProvider } from './tensorBoardImportCodeLensProvider';
import { TensorBoardFileWatcher } from './tensorBoardFileWatcher';
import { TensorBoardUsageTracker } from './tensorBoardUsageTracker';
import { TensorBoardPrompt } from './tensorBoardPrompt';
import { TensorBoardSessionProvider } from './tensorBoardSessionProvider';
import { TensorBoardNbextensionCodeLensProvider } from './nbextensionCodeLensProvider';

export function registerTypes(serviceManager: IServiceManager): void {
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        TensorBoardSessionProvider,
    );
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        TensorBoardFileWatcher,
    );
    serviceManager.addSingleton<TensorBoardPrompt>(TensorBoardPrompt, TensorBoardPrompt);
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        TensorBoardUsageTracker,
    );
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        TensorBoardImportCodeLensProvider,
    );
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        TensorBoardNbextensionCodeLensProvider,
    );
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        TensorBoardCodeActionProvider,
    );
}
