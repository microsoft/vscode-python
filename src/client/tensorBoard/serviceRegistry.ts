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
import { TerminalWatcher } from './terminalWatcher';

export function registerTypes(serviceManager: IServiceManager): void {
    serviceManager.addSingleton<TensorBoardSessionProvider>(TensorBoardSessionProvider, TensorBoardSessionProvider);
    serviceManager.addBinding(TensorBoardSessionProvider, IExtensionSingleActivationService);
    serviceManager.addSingleton<TensorBoardFileWatcher>(TensorBoardFileWatcher, TensorBoardFileWatcher);
    serviceManager.addBinding(TensorBoardFileWatcher, IExtensionSingleActivationService);
    serviceManager.addSingleton<TensorBoardPrompt>(TensorBoardPrompt, TensorBoardPrompt);
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        TensorBoardUsageTracker,
    );
    serviceManager.addSingleton<TensorBoardImportCodeLensProvider>(
        TensorBoardImportCodeLensProvider,
        TensorBoardImportCodeLensProvider,
    );
    serviceManager.addBinding(TensorBoardImportCodeLensProvider, IExtensionSingleActivationService);
    serviceManager.addSingleton<TensorBoardNbextensionCodeLensProvider>(
        TensorBoardNbextensionCodeLensProvider,
        TensorBoardNbextensionCodeLensProvider,
    );
    serviceManager.addBinding(TensorBoardNbextensionCodeLensProvider, IExtensionSingleActivationService);
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        TensorBoardCodeActionProvider,
    );
    serviceManager.addSingleton(IExtensionSingleActivationService, TerminalWatcher);
}
