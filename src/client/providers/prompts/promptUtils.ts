// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ConfigurationTarget, Uri } from 'vscode';
import { ShowFormatterExtensionPrompt } from '../../common/experiments/groups';
import { IExperimentService, IPersistentState, IPersistentStateFactory } from '../../common/types';
import { executeCommand } from '../../common/vscodeApis/commandApis';
import { isInsider } from '../../common/vscodeApis/extensionsApi';
import { getConfiguration, getWorkspaceFolder } from '../../common/vscodeApis/workspaceApis';
import { IServiceContainer } from '../../ioc/types';

export function inFormatterExtensionExperiment(serviceContainer: IServiceContainer): boolean {
    const experiment = serviceContainer.get<IExperimentService>(IExperimentService);
    return experiment.inExperimentSync(ShowFormatterExtensionPrompt.experiment);
}

export function doNotShowPromptState(key: string, serviceContainer: IServiceContainer): IPersistentState<boolean> {
    const persistFactory = serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
    const promptState = persistFactory.createWorkspacePersistentState<boolean>(key, false);
    return promptState;
}

export async function updateDefaultFormatter(extensionId: string, resource?: Uri): Promise<void> {
    const scope = getWorkspaceFolder(resource) ? ConfigurationTarget.Workspace : ConfigurationTarget.Global;

    const config = getConfiguration('python', resource);
    const editorConfig = getConfiguration('editor', { uri: resource, languageId: 'python' });
    await editorConfig.update('defaultFormatter', extensionId, scope, true);
    await config.update('formatting.provider', 'none', scope);
}

export async function installFormatterExtension(extensionId: string, resource?: Uri): Promise<void> {
    await executeCommand('workbench.extensions.installExtension', extensionId, {
        installPreReleaseVersion: isInsider(),
    });

    await updateDefaultFormatter(extensionId, resource);
}
