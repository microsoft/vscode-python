// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Disposable } from 'vscode';
import { IApplicationEnvironment, IApplicationShell, ICommandManager } from '../../common/application/types';
import { PYLANCE_EXTENSION_ID } from '../../common/constants';
import { IExtensions } from '../../common/types';
import { createDeferred } from '../../common/utils/async';
import { Common, LanguageService, Pylance } from '../../common/utils/localize';
import { getPylanceExtensionUri } from '../../languageServices/proposeLanguageServerBanner';
import { LanguageServerType } from '../types';

export async function promptForPylanceInstall(
    appShell: IApplicationShell,
    appEnv: IApplicationEnvironment
): Promise<void> {
    // If not installed, point user to Pylance at the store.
    const response = await appShell.showWarningMessage(
        Pylance.installPylanceMessage(),
        Common.bannerLabelYes(),
        Common.bannerLabelNo()
    );

    if (response === Common.bannerLabelYes()) {
        appShell.openUrl(getPylanceExtensionUri(appEnv));
    }
}

// Tracks language server type and issues appropriate reload or install prompts.
export class LanguageServerChangeHandler implements Disposable {
    // For tests that need to track Pylance install completion.
    private readonly pylanceInstallCompletedDeferred = createDeferred<void>();
    private readonly disposables: Disposable[] = [];
    private pylanceInstalled = false;

    constructor(
        private currentLsType: LanguageServerType | undefined,
        private readonly extensions: IExtensions,
        private readonly appShell: IApplicationShell,
        private readonly appEnv: IApplicationEnvironment,
        private readonly commands: ICommandManager
    ) {
        this.pylanceInstalled = this.isPylanceInstalled();
        this.disposables.push(
            extensions.onDidChange(async () => {
                await this.extensionsChangeHandler();
            })
        );
    }

    public dispose(): void {
        while (this.disposables.length) {
            this.disposables.pop()?.dispose();
        }
    }

    // For tests that need to track Pylance install completion.
    get pylanceInstallCompleted(): Promise<void> {
        return this.pylanceInstallCompletedDeferred.promise;
    }

    public async handleLanguageServerChange(lsType: LanguageServerType | undefined): Promise<void> {
        if (this.currentLsType === lsType) {
            return;
        }
        // VS Code has to be reloaded when language server type changes. In case of Pylance
        // it also has to be installed manually by the user. We avoid prompting to reload
        // if target changes to Pylance when Pylance is not installed since otherwise user
        // may get one reload prompt now and then another when Pylance is finally installed.
        // Instead, check the installation and suppress prompt if Pylance is not there.
        // Extensions change event handler will then show its own prompt.
        let response: string | undefined;
        if (lsType === LanguageServerType.Node && !this.isPylanceInstalled()) {
            // If not installed, point user to Pylance at the store.
            await promptForPylanceInstall(this.appShell, this.appEnv);
            // At this point Pylance is not yet installed. Skip reload prompt
            // since we are going to show it when Pylance becomes available.
        } else {
            response = await this.appShell.showInformationMessage(
                LanguageService.reloadAfterLanguageServerChange(),
                Common.reload()
            );
            if (response === Common.reload()) {
                this.commands.executeCommand('workbench.action.reloadWindow');
            }
        }
        this.currentLsType = lsType;
    }

    private async extensionsChangeHandler(): Promise<void> {
        // Track Pylance extension installation state and prompt to reload when it becomes available.
        const oldInstallState = this.pylanceInstalled;
        this.pylanceInstalled = this.isPylanceInstalled();
        if (oldInstallState === this.pylanceInstalled) {
            this.pylanceInstallCompletedDeferred.resolve();
            return;
        }

        const response = await this.appShell.showWarningMessage(
            Pylance.pylanceInstalledReloadPromptMessage(),
            Common.bannerLabelYes(),
            Common.bannerLabelNo()
        );

        this.pylanceInstallCompletedDeferred.resolve();
        if (response === Common.bannerLabelYes()) {
            this.commands.executeCommand('workbench.action.reloadWindow');
        }
    }

    private isPylanceInstalled(): boolean {
        return !!this.extensions.getExtension(PYLANCE_EXTENSION_ID);
    }
}
