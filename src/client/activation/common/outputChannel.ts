// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IApplicationShell, ICommandManager } from '../../common/application/types';
import '../../common/extensions';
import { IOutputChannel } from '../../common/types';
import { OutputChannelNames } from '../../common/utils/localize';
import { ILanguageServerOutputChannel } from '../types';

@injectable()
export class LanguageServerOutputChannel implements ILanguageServerOutputChannel {
    public output: IOutputChannel | undefined;

    private registered = false;

    constructor(
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
    ) {}

    public get channel(): IOutputChannel {
        if (!this.output) {
            this.output = this.appShell.createOutputChannel(OutputChannelNames.languageServer());
            this.registerCommand().ignoreErrors();
        }
        return this.output;
    }

    private async registerCommand() {
        if (this.registered) {
            return;
        }
        this.registered = true;
        // This controls the visibility of the command used to display the LS Output panel.
        // We don't want to display it when Jedi is used instead of LS.
        await this.commandManager.executeCommand('setContext', 'python.hasLanguageServerOutputChannel', true);
        this.commandManager.registerCommand('python.viewLanguageServerOutput', () => this.output!.show(true));
    }
}
