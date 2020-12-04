// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IExtensionSingleActivationService } from '../activation/types';
import { IServiceManager } from '../ioc/types';
import { TensorBoardFileWatcher } from './tensorBoardFileWatcher';
import { TensorBoardImportTracker } from './tensorBoardImportTracker';
import { TensorBoardPrompt } from './tensorBoardPrompt';
import { TensorBoardSessionProvider } from './tensorBoardSessionProvider';
import { ITensorBoardImportTracker } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        TensorBoardSessionProvider
    );
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        TensorBoardFileWatcher
    );
    serviceManager.addSingleton<TensorBoardPrompt>(TensorBoardPrompt, TensorBoardPrompt);
    serviceManager.addSingleton<ITensorBoardImportTracker>(ITensorBoardImportTracker, TensorBoardImportTracker);
    serviceManager.addBinding(ITensorBoardImportTracker, IExtensionSingleActivationService);
}
