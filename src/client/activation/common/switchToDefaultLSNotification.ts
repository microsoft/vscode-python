// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { ConfigurationTarget } from 'vscode';
import { IApplicationShell, IWorkspaceService } from '../../common/application/types';
import { Common, SwitchToDefaultLS } from '../../common/utils/localize';
import { ISwitchToDefaultLSNotification, LanguageServerType } from '../types';

@injectable()
export class SwitchToDefaultLSNotification implements ISwitchToDefaultLSNotification {
    constructor(
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
        @inject(IWorkspaceService) private readonly workspace: IWorkspaceService,
    ) {}

    public get shouldShowPrompt(): boolean {
        let changed = false;
        const config = this.workspace.getConfiguration('python');
        const value = config.inspect<string>('languageServer');
        if (value?.workspaceValue === LanguageServerType.Microsoft) {
            config.update('languageServer', 'Default', ConfigurationTarget.Workspace);
            changed = true;
        }

        if (value?.globalValue === LanguageServerType.Microsoft) {
            config.update('languageServer', 'Default', ConfigurationTarget.Global);
            changed = true;
        }

        return changed;
    }

    public async showPrompt(): Promise<void> {
        if (!this.shouldShowPrompt) {
            return;
        }

        await this.appShell.showWarningMessage(SwitchToDefaultLS.bannerMessage(), Common.ok());
    }
}
