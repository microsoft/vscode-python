// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IExtensionActivationService } from '../activation/types';
import { IServiceManager } from '../ioc/types';
import { TensorBoardFileWatcher } from './tensorBoardFileWatcher';
import { TensorBoardPrompt } from './tensorBoardPrompt';
import { TensorBoardSessionProvider } from './tensorBoardSessionProvider';
import { ITensorBoardSessionProvider } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<ITensorBoardSessionProvider>(ITensorBoardSessionProvider, TensorBoardSessionProvider);
    serviceManager.addSingleton<IExtensionActivationService>(IExtensionActivationService, TensorBoardFileWatcher);
    serviceManager.addSingleton<TensorBoardPrompt>(TensorBoardPrompt, TensorBoardPrompt);
}
