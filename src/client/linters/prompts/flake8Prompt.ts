// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IApplicationEnvironment } from '../../common/application/types';
import { Common, ToolsExtensions } from '../../common/utils/localize';
import { executeCommand } from '../../common/vscodeApis/commandApis';
import { showInformationMessage } from '../../common/vscodeApis/windowApis';
import { IServiceContainer } from '../../ioc/types';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { isExtensionInstalled, doNotShowPromptState, inToolsExtensionsExperiment } from './common';
import { IToolsExtensionPrompt } from './types';

export const FLAKE8_EXTENSION = 'ms-python.flake8';
const FLAKE8_PROMPT_DONOTSHOW_KEY = 'showFlake8ExtensionPrompt';

export class Flake8ExtensionPrompt implements IToolsExtensionPrompt {
    private shownThisSession = false;

    public constructor(private readonly serviceContainer: IServiceContainer) {}

    public async showPrompt(): Promise<boolean> {
        if (isExtensionInstalled(this.serviceContainer, FLAKE8_EXTENSION)) {
            sendTelemetryEvent(EventName.TOOLS_EXTENSIONS_ALREADY_INSTALLED, undefined, {
                extensionId: FLAKE8_EXTENSION,
            });
            return true;
        }

        const doNotShow = doNotShowPromptState(this.serviceContainer, FLAKE8_PROMPT_DONOTSHOW_KEY);
        if (this.shownThisSession || doNotShow.value) {
            return false;
        }

        if (!(await inToolsExtensionsExperiment(this.serviceContainer))) {
            return false;
        }

        this.shownThisSession = true;
        const response = await showInformationMessage(
            ToolsExtensions.flake8PromptMessage,
            ToolsExtensions.installFlake8Extension,
            Common.doNotShowAgain,
        );

        if (response === Common.doNotShowAgain) {
            doNotShow.updateValue(true);
            return false;
        }

        if (response === ToolsExtensions.installFlake8Extension) {
            const appEnv: IApplicationEnvironment = this.serviceContainer.get<IApplicationEnvironment>(
                IApplicationEnvironment,
            );
            await executeCommand('workbench.extensions.installExtension', FLAKE8_EXTENSION, {
                installPreReleaseVersion: appEnv.extensionChannel === 'insiders',
            });
            return true;
        }

        return false;
    }
}

let _prompt: IToolsExtensionPrompt | undefined;
export function getOrCreateFlake8Prompt(serviceContainer: IServiceContainer): IToolsExtensionPrompt {
    if (!_prompt) {
        _prompt = new Flake8ExtensionPrompt(serviceContainer);
    }
    return _prompt;
}
