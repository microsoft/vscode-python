// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IApplicationEnvironment } from '../../common/application/types';
import { IPersistentState, IPersistentStateFactory } from '../../common/types';
import { Common, ToolsExtensions } from '../../common/utils/localize';
import { executeCommand } from '../../common/vscodeApis/commandApis';
import { isExtensionDisabled, isExtensionEnabled } from '../../common/vscodeApis/extensionsApi';
import { showInformationMessage } from '../../common/vscodeApis/windowApis';
import { IServiceContainer } from '../../ioc/types';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';

export const ISORT_EXTENSION = 'ms-python.isort';
const ISORT_PROMPT_DONOTSHOW_KEY = 'showISortExtensionPrompt';

function doNotShowPromptState(serviceContainer: IServiceContainer, promptKey: string): IPersistentState<boolean> {
    const persistFactory: IPersistentStateFactory = serviceContainer.get<IPersistentStateFactory>(
        IPersistentStateFactory,
    );
    return persistFactory.createWorkspacePersistentState<boolean>(promptKey, false);
}

export class ISortExtensionPrompt {
    private shownThisSession = false;

    public constructor(private readonly serviceContainer: IServiceContainer) {}

    public async showPrompt(): Promise<boolean> {
        const isEnabled = isExtensionEnabled(ISORT_EXTENSION);
        if (isEnabled || isExtensionDisabled(ISORT_EXTENSION)) {
            sendTelemetryEvent(EventName.TOOLS_EXTENSIONS_ALREADY_INSTALLED, undefined, {
                extensionId: ISORT_EXTENSION,
                isEnabled,
            });
            return true;
        }

        const doNotShow = doNotShowPromptState(this.serviceContainer, ISORT_PROMPT_DONOTSHOW_KEY);
        if (this.shownThisSession || doNotShow.value) {
            return false;
        }

        sendTelemetryEvent(EventName.TOOLS_EXTENSIONS_PROMPT_SHOWN, undefined, { extensionId: ISORT_EXTENSION });
        this.shownThisSession = true;
        const response = await showInformationMessage(
            ToolsExtensions.isortPromptMessage,
            ToolsExtensions.installISortExtension,
            Common.doNotShowAgain,
        );

        if (response === Common.doNotShowAgain) {
            await doNotShow.updateValue(true);
            sendTelemetryEvent(EventName.TOOLS_EXTENSIONS_PROMPT_DISMISSED, undefined, {
                extensionId: ISORT_EXTENSION,
                dismissType: 'doNotShow',
            });
            return false;
        }

        if (response === ToolsExtensions.installISortExtension) {
            sendTelemetryEvent(EventName.TOOLS_EXTENSIONS_INSTALL_SELECTED, undefined, {
                extensionId: ISORT_EXTENSION,
            });
            const appEnv: IApplicationEnvironment = this.serviceContainer.get<IApplicationEnvironment>(
                IApplicationEnvironment,
            );
            await executeCommand('workbench.extensions.installExtension', ISORT_EXTENSION, {
                installPreReleaseVersion: appEnv.extensionChannel === 'insiders',
            });
            return true;
        }

        sendTelemetryEvent(EventName.TOOLS_EXTENSIONS_PROMPT_DISMISSED, undefined, {
            extensionId: ISORT_EXTENSION,
            dismissType: 'close',
        });

        return false;
    }
}

let _prompt: ISortExtensionPrompt | undefined;
export function getOrCreateISortPrompt(serviceContainer: IServiceContainer): ISortExtensionPrompt {
    if (!_prompt) {
        _prompt = new ISortExtensionPrompt(serviceContainer);
    }
    return _prompt;
}
