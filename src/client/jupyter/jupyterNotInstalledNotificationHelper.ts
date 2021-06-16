// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable, inject } from 'inversify';
import { IApplicationShell, IJupyterExtensionDependencyManager } from '../common/application/types';
import { IPersistentStateFactory } from '../common/types';
import { Common, Jupyter } from '../common/utils/localize';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { IJupyterNotInstalledNotificationHelper, JupyterNotInstalledOrigin } from './types';

export const jupyterExtensionNotInstalledKey = 'jupyterExtensionNotInstalledKey';

@injectable()
export class JupyterNotInstalledNotificationHelper implements IJupyterNotInstalledNotificationHelper {
    constructor(
        @inject(IApplicationShell) private appShell: IApplicationShell,
        @inject(IPersistentStateFactory) private persistentState: IPersistentStateFactory,
        @inject(IJupyterExtensionDependencyManager) private depsManager: IJupyterExtensionDependencyManager,
    ) {}

    public shouldShowJupypterExtensionNotInstalledPrompt(): boolean {
        const doNotShowAgain = this.persistentState.createGlobalPersistentState(jupyterExtensionNotInstalledKey, false);

        if (doNotShowAgain.value) {
            return false;
        }

        const isInstalled = this.depsManager.isJupyterExtensionInstalled;

        return !isInstalled;
    }

    public async showJupyterNotInstalledPrompt(entrypoint: JupyterNotInstalledOrigin): Promise<void> {
        sendTelemetryEvent(EventName.JUPYTER_NOT_INSTALLED_NOTIFICATION_DISPLAYED, undefined, { entrypoint });

        const prompts = [Common.doNotShowAgain()];
        const telemetrySelections: ['Do not show again'] = ['Do not show again'];

        const selection = await this.appShell.showInformationMessage(
            Jupyter.jupyterExtensionNotInstalled(),
            ...prompts,
        );

        sendTelemetryEvent(EventName.JUPYTER_NOT_INSTALLED_NOTIFICATION_ACTION, undefined, {
            selection: selection ? telemetrySelections[prompts.indexOf(selection)] : undefined,
        });

        if (!selection) {
            return;
        }

        // Never show this prompt again
        await this.persistentState
            .createGlobalPersistentState(jupyterExtensionNotInstalledKey, false)
            .updateValue(true);
    }
}
