// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IApplicationEnvironment } from '../../common/application/types';
import { Common, ToolsExtensions } from '../../common/utils/localize';
import { executeCommand } from '../../common/vscodeApis/commandApis';
import { showInformationMessage } from '../../common/vscodeApis/windowApis';
import { IServiceContainer } from '../../ioc/types';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { doNotShowPromptState, inToolsExtensionsExperiment, isExtensionInstalled } from './common';
import { IToolsExtensionPrompt } from './types';

export const PYLINT_EXTENSION = 'ms-python.pylint';
const PYLINT_PROMPT_DONOTSHOW_KEY = 'showPylintExtensionPrompt';

export class PylintExtensionPrompt implements IToolsExtensionPrompt {
    private shownThisSession = false;

    public constructor(private readonly serviceContainer: IServiceContainer) {}

    public async showPrompt(): Promise<boolean> {
        if (isExtensionInstalled(this.serviceContainer, PYLINT_EXTENSION)) {
            sendTelemetryEvent(EventName.TOOLS_EXTENSIONS_ALREADY_INSTALLED, undefined, {
                extensionId: PYLINT_EXTENSION,
            });
            return true;
        }

        const doNotShow = doNotShowPromptState(this.serviceContainer, PYLINT_PROMPT_DONOTSHOW_KEY);
        if (this.shownThisSession || doNotShow.value) {
            return false;
        }

        if (!(await inToolsExtensionsExperiment(this.serviceContainer))) {
            return false;
        }

        sendTelemetryEvent(EventName.TOOLS_EXTENSIONS_PROMPT_SHOWN, undefined, { extensionId: PYLINT_EXTENSION });
        this.shownThisSession = true;
        const response = await showInformationMessage(
            ToolsExtensions.pylintPromptMessage,
            ToolsExtensions.installPylintExtension,
            Common.doNotShowAgain,
        );

        if (response === Common.doNotShowAgain) {
            await doNotShow.updateValue(true);
            sendTelemetryEvent(EventName.TOOLS_EXTENSIONS_PROMPT_DISMISSED, undefined, {
                extensionId: PYLINT_EXTENSION,
                dismissType: 'doNotShow',
            });
            return false;
        }

        if (response === ToolsExtensions.installPylintExtension) {
            sendTelemetryEvent(EventName.TOOLS_EXTENSIONS_INSTALL_SELECTED, undefined, {
                extensionId: PYLINT_EXTENSION,
            });
            const appEnv: IApplicationEnvironment = this.serviceContainer.get<IApplicationEnvironment>(
                IApplicationEnvironment,
            );
            await executeCommand('workbench.extensions.installExtension', PYLINT_EXTENSION, {
                installPreReleaseVersion: appEnv.extensionChannel === 'insiders',
            });
            return true;
        }

        sendTelemetryEvent(EventName.TOOLS_EXTENSIONS_PROMPT_DISMISSED, undefined, {
            extensionId: PYLINT_EXTENSION,
            dismissType: 'close',
        });

        return false;
    }
}

let _prompt: IToolsExtensionPrompt | undefined;
export function getOrCreatePylintPrompt(serviceContainer: IServiceContainer): IToolsExtensionPrompt {
    if (!_prompt) {
        _prompt = new PylintExtensionPrompt(serviceContainer);
    }
    return _prompt;
}
