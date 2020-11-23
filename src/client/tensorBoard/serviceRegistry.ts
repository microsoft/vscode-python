// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IExtensionSingleActivationService } from '../activation/types';
import { NativeTensorBoard } from '../common/experiments/groups';
import { IExperimentService } from '../common/types';
import { IServiceManager } from '../ioc/types';
import { TensorBoardSessionProvider } from './tensorBoardSessionProvider';

export async function registerTypes(serviceManager: IServiceManager) {
    const experimentService = serviceManager.get<IExperimentService>(IExperimentService);
    if (await experimentService.inExperiment(NativeTensorBoard.experiment)) {
        serviceManager.addSingleton<IExtensionSingleActivationService>(
            IExtensionSingleActivationService,
            TensorBoardSessionProvider
        );
    }
}
