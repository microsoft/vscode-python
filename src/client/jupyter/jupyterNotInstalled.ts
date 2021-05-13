// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IApplicationShell, ICommandManager, IJupyterExtensionDependencyManager } from '../common/application/types';
import { JUPYTER_EXTENSION_ID } from '../common/constants';
import { IPersistentStateFactory } from '../common/types';
import { Common, Jupyter } from '../common/utils/localize';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { JupyterNotInstalledOrigin } from './types';

export const jupyterExtensionNotInstalledKey = 'jupyterExtensionNotInstalledKey';

export function shouldShowJupypterExtensionNotInstalledPrompt(
    depsManager: IJupyterExtensionDependencyManager,
    persistentState: IPersistentStateFactory,
): boolean {
    const doNotShowAgain = persistentState.createGlobalPersistentState(jupyterExtensionNotInstalledKey, false);

    if (doNotShowAgain.value) {
        return false;
    }

    const isInstalled = depsManager.isJupyterExtensionInstalled;

    return !isInstalled;
}

export async function jupyterNotInstalledPrompt(
    entrypoint: JupyterNotInstalledOrigin,
    appShell: IApplicationShell,
    persistentState: IPersistentStateFactory,
    commandManager: ICommandManager,
): Promise<void> {
    sendTelemetryEvent(EventName.JUPYTER_NOT_INSTALLED_NOTIFICATION_DISPLAYED, undefined, { entrypoint });

    const prompts = [Common.install(), Common.doNotShowAgain()];
    const telemetrySelections: ['Install', 'Do not show again'] = ['Install', 'Do not show again'];

    const selection = await appShell.showInformationMessage(Jupyter.jupyterExtensionNotInstalled(), ...prompts);

    sendTelemetryEvent(EventName.JUPYTER_NOT_INSTALLED_NOTIFICATION_ACTION, undefined, {
        selection: selection ? telemetrySelections[prompts.indexOf(selection)] : undefined,
    });

    if (!selection) {
        return;
    }

    if (selection === Common.install()) {
        // Install the Jupyter extension
        commandManager.executeCommand('extension.open', JUPYTER_EXTENSION_ID);
    } else if (selection === Common.doNotShowAgain()) {
        // Never show this prompt again
        await persistentState.createGlobalPersistentState(jupyterExtensionNotInstalledKey, false).updateValue(true);
    }
}
