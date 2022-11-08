// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs-extra';
import * as path from 'path';
import { ShowToolsExtensionPrompt } from '../../common/experiments/groups';
import { IExperimentService, IExtensions, IPersistentState, IPersistentStateFactory } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { traceLog } from '../../logging';

function isExtensionInstalledButDisabled(extensions: IExtensions, extensionId: string): boolean {
    // When debugging the python extension this `extensionPath` below will point to your repo.
    // If you are debugging this feature then set the `extensionPath` to right location after
    // the next line.
    const pythonExt = extensions.getExtension('ms-python.python');
    if (pythonExt) {
        let found = false;
        traceLog(`Extension search path: ${path.dirname(pythonExt.extensionPath)}`);
        fs.readdirSync(path.dirname(pythonExt.extensionPath), { withFileTypes: false }).forEach((s) => {
            if (s.toString().startsWith(extensionId)) {
                found = true;
            }
        });
        return found;
    }
    return false;
}

export function isExtensionInstalled(serviceContainer: IServiceContainer, extensionId: string): boolean {
    const extensions: IExtensions = serviceContainer.get<IExtensions>(IExtensions);
    const extension = extensions.getExtension(extensionId);
    if (!extension) {
        // The extension you are looking for might be disabled.
        return isExtensionInstalledButDisabled(extensions, extensionId);
    }
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
