// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IApplicationShell } from '../../common/application/types';
import { IPersistentStateFactory } from '../../common/types';
import { Common, Python27Support } from '../../common/utils/localize';
import { IPython27SupportPrompt } from '../contracts';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { PythonEnvironment } from '../../pythonEnvironments/info';

const doNotShowPromptStateKey = 'MESSAGE_KEY_FOR_27_SUPPORT_PROMPT';

@injectable()
export class Python27SupportPrompt implements IPython27SupportPrompt {
    // If the prompt has been shown earlier during this session.
    private promptShownInSession = false;

    constructor(
        @inject(IApplicationShell) private appShell: IApplicationShell,
        @inject(IPersistentStateFactory) private persistentState: IPersistentStateFactory,
    ) {}

    public async shouldShowPrompt(interpreter: PythonEnvironment): Promise<boolean> {
        // Check if "Do not show again" has been selected before.
        const doNotShowAgain = this.persistentState.createGlobalPersistentState<boolean>(
            doNotShowPromptStateKey,
            false,
        );

        if (doNotShowAgain.value || this.promptShownInSession) {
            return Promise.resolve(false);
        }

        // Check if current environment version is Python 2.7
        if (interpreter.version?.major === 2 && interpreter.version?.minor === 7) {
            return Promise.resolve(true);
        }

        return Promise.resolve(false);
    }

    public async showPrompt(): Promise<void> {
        const selection = await this.appShell.showInformationMessage(Python27Support.bannerMessage(), Common.gotIt());

        // Never show the prompt again.
        if (selection === Common.gotIt()) {
            this.persistentState.createGlobalPersistentState<boolean>(doNotShowPromptStateKey, false).updateValue(true);
        }

        // Do not show the prompt again in this session.
        this.promptShownInSession = true;

        sendTelemetryEvent(EventName.PYTHON_27_SUPPORT_PROMPT);
    }
}
