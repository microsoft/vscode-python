// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject } from 'inversify';
import { IApplicationShell } from '../common/application/types';
import { EXTENSION_VERSION_MEMENTO } from '../common/startPage/startPage';
import { IExtensionContext } from '../common/types';
import { Common, Pylance } from '../common/utils/localize';
import { IExtensionSingleActivationService } from './types';

export const PYLANCE_PROMPT_MEMENTO = 'pylanceDefaultPromptMemento';

export class DefaultLanguageServerActivation implements IExtensionSingleActivationService {
    constructor(
        @inject(IApplicationShell) private appShell: IApplicationShell,
        @inject(IExtensionContext) private readonly context: IExtensionContext,
    ) {}

    public async activate(): Promise<void> {
        if (this.shouldShowPrompt()) {
            await this.showPrompt();
        }
    }

    private shouldShowPrompt(): boolean {
        const savedVersion: string | undefined = this.context.globalState.get(EXTENSION_VERSION_MEMENTO);
        const promptShown: boolean | undefined = this.context.globalState.get(PYLANCE_PROMPT_MEMENTO);

        // savedVersion being undefined means that this is the first time the user activates the extension.
        // promptShown being undefined means that this is the first time we check if we should show the prompt.
        return savedVersion !== undefined && promptShown === undefined;
    }

    private async showPrompt(): Promise<void> {
        await this.appShell.showInformationMessage(Pylance.pylanceDefaultLSMessage(), Common.ok()).then(async () => {
            await this.context.globalState.update(PYLANCE_PROMPT_MEMENTO, true);
        });
    }
}
