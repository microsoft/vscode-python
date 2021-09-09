// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ConfigurationTarget } from 'vscode';
import { IApplicationShell, IWorkspaceService } from '../../common/application/types';
import {
    IConfigurationService,
    IDefaultLanguageServer,
    IPersistentState,
    IPersistentStateFactory,
} from '../../common/types';
import { MPLSDeprecation } from '../../common/utils/localize';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { IMPLSDeprecationPrompt, LanguageServerType } from '../types';

// Exported for testing.
export const mplsDeprecationPromptStateKey = 'MESSAGE_KEY_FOR_MPLS_DEPRECATION_PROMPT2';
export const mplsDeprecationPromptFrequency = 1000 * 60 * 60 * 24 * 7; // One week.

@injectable()
export class MPLSDeprecationPrompt implements IMPLSDeprecationPrompt {
    // If the prompt has been shown earlier during this session.
    private promptShownInSession = false;

    constructor(
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
        @inject(IPersistentStateFactory) private readonly persistentState: IPersistentStateFactory,
        @inject(IWorkspaceService) private readonly workspace: IWorkspaceService,
        @inject(IConfigurationService) private readonly configService: IConfigurationService,
        @inject(IDefaultLanguageServer) private readonly defaultLanguageServer: IDefaultLanguageServer,
    ) {}

    public get shouldShowPrompt(): boolean {
        if (this.getPersistentState().value || this.promptShownInSession) {
            return false;
        }
        return true;
    }

    public async showPrompt(): Promise<void> {
        if (!this.shouldShowPrompt) {
            return;
        }

        const selection = await this.appShell.showWarningMessage(
            MPLSDeprecation.bannerMessage(),
            MPLSDeprecation.switchToPylance(),
            MPLSDeprecation.switchToJedi(),
        );

        let switchTo: LanguageServerType.Node | LanguageServerType.Jedi | undefined;
        if (selection === MPLSDeprecation.switchToPylance()) {
            switchTo = LanguageServerType.Node;
        } else if (selection === MPLSDeprecation.switchToJedi()) {
            switchTo = LanguageServerType.Jedi;
        }

        this.getPersistentState().updateValue(true);

        if (switchTo) {
            await this.switchLanguageServer(switchTo);
        }

        // Do not show the prompt again in this session.
        this.promptShownInSession = true;

        sendTelemetryEvent(EventName.MPLS_DEPRECATION_PROMPT, undefined, { switchTo });
    }

    private getPersistentState(): IPersistentState<boolean> {
        const target = this.getConfigurationTarget();
        if (target === ConfigurationTarget.Global) {
            return this.persistentState.createGlobalPersistentState<boolean>(
                mplsDeprecationPromptStateKey,
                false,
                mplsDeprecationPromptFrequency,
            );
        }
        return this.persistentState.createWorkspacePersistentState<boolean>(
            mplsDeprecationPromptStateKey,
            false,
            mplsDeprecationPromptFrequency,
        );
    }

    private getConfigurationTarget() {
        const inspection = this.workspace.getConfiguration('python').inspect<string>('languageServer');

        let target: ConfigurationTarget;
        if (inspection?.workspaceValue) {
            target = ConfigurationTarget.Workspace;
        } else if (inspection?.globalValue) {
            target = ConfigurationTarget.Global;
        } else {
            throw new Error('python.languageServer is set in an impossible location');
        }

        return target;
    }

    private async switchLanguageServer(lsType: LanguageServerType.Node | LanguageServerType.Jedi): Promise<void> {
        let defaultType = this.defaultLanguageServer.defaultLSType;
        if (defaultType === LanguageServerType.JediLSP) {
            defaultType = LanguageServerType.Jedi;
        }

        // If changing to the default, unset the setting instead of explicitly setting it.
        const changeTo = lsType !== defaultType ? lsType : undefined;
        const target = this.getConfigurationTarget();
        await this.configService.updateSetting('languageServer', changeTo, undefined, target);

        // No reload; the LanguageServerChangeHandler service will do this at the user's request.
    }
}
