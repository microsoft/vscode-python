// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ShowToolsExtensionPrompt } from '../../common/experiments/groups';
import { IExperimentService, IExtensions, IPersistentState, IPersistentStateFactory } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';

export function isExtensionInstalled(serviceContainer: IServiceContainer, extensionId: string): boolean {
    const extensions: IExtensions = serviceContainer.get<IExtensions>(IExtensions);
    const extension = extensions.getExtension(extensionId);
    return extension !== undefined;
}

export function doNotShowPromptState(
    serviceContainer: IServiceContainer,
    promptKey: string,
): IPersistentState<boolean> {
    const persistFactory: IPersistentStateFactory = serviceContainer.get<IPersistentStateFactory>(
        IPersistentStateFactory,
    );
    return persistFactory.createWorkspacePersistentState<boolean>(promptKey, false);
}

export function inToolsExtensionsExperiment(serviceContainer: IServiceContainer): Promise<boolean> {
    const experiments: IExperimentService = serviceContainer.get<IExperimentService>(IExperimentService);
    return experiments.inExperiment(ShowToolsExtensionPrompt.experiment);
}
