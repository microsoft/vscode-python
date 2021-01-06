// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IExtensionSingleActivationService } from '../activation/types';
import { IServiceManager } from '../ioc/types';
import { TensorBoardCodeActionProvider } from './tensorBoardCodeActionProvider';
import { TensorBoardCodeLensProvider } from './tensorBoardCodeLensProvider';
import { TensorBoardFileWatcher } from './tensorBoardFileWatcher';
import { TensorBoardImportTracker } from './tensorBoardImportTracker';
import { TensorBoardPrompt } from './tensorBoardPrompt';
import { TensorBoardSessionProvider } from './tensorBoardSessionProvider';
import { ITensorBoardImportTracker } from './types';

export function registerTypes(serviceManager: IServiceManager): void {
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        TensorBoardSessionProvider,
    );
    serviceManager.addSingleton<TensorBoardFileWatcher>(TensorBoardFileWatcher, TensorBoardFileWatcher);
    serviceManager.addBinding(TensorBoardFileWatcher, IExtensionSingleActivationService);
    serviceManager.addSingleton<TensorBoardPrompt>(TensorBoardPrompt, TensorBoardPrompt);
    serviceManager.addSingleton<ITensorBoardImportTracker>(ITensorBoardImportTracker, TensorBoardImportTracker);
    serviceManager.addBinding(ITensorBoardImportTracker, IExtensionSingleActivationService);
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        TensorBoardCodeLensProvider,
    );
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        TensorBoardCodeActionProvider,
    );
}
