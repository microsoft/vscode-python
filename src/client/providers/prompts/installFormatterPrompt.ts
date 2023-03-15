// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ConfigurationTarget, Uri } from 'vscode';
import {
    IApplicationEnvironment,
    IApplicationShell,
    ICommandManager,
    IWorkspaceService,
} from '../../common/application/types';
import { ShowFormatterExtensionPrompt } from '../../common/experiments/groups';
import { IExperimentService, IExtensions, IPersistentStateFactory } from '../../common/types';
import { Common, ToolsExtensions } from '../../common/utils/localize';
import { IServiceContainer } from '../../ioc/types';
import { AUTOPEP8_EXTENSION, BLACK_EXTENSION, IInstallFormatterPrompt } from './types';

const SHOW_FORMATTER_INSTALL_PROMPT_DONOTSHOW_KEY = 'showFormatterExtensionInstallPrompt';

export class SelectFormatterPrompt implements IInstallFormatterPrompt {
    private shownThisSession = false;

    private readonly extensions: IExtensions;

    private readonly workspaceService: IWorkspaceService;

    constructor(private readonly serviceContainer: IServiceContainer) {
        this.extensions = this.serviceContainer.get<IExtensions>(IExtensions);
        this.workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
    }

    public async showInstallFormatterPrompt(resource?: Uri): Promise<void> {
        const experiment = this.serviceContainer.get<IExperimentService>(IExperimentService);
        if (!(await experiment.inExperiment(ShowFormatterExtensionPrompt.experiment))) {
            return;
        }

        const persistFactory = this.serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
        const promptState = persistFactory.createWorkspacePersistentState<boolean>(
            SHOW_FORMATTER_INSTALL_PROMPT_DONOTSHOW_KEY,
            false,
        );
        if (this.shownThisSession || promptState.value) {
            return;
        }

        const config = this.workspaceService.getConfiguration('python', resource);
        const formatter = config.get<string>('formatting.provider', 'none');

        if (!['autopep8', 'black'].includes(formatter)) {
            return;
        }

        const black = this.extensions.getExtension(BLACK_EXTENSION);
        const autopep8 = this.extensions.getExtension(AUTOPEP8_EXTENSION);

        const appShell: IApplicationShell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
        this.shownThisSession = true;

        if (formatter === 'black' && !black) {
            const selection = await appShell.showInformationMessage(
                ToolsExtensions.installBlackFormatterPrompt,
                Common.install,
                Common.doNotShowAgain,
            );
            if (selection === Common.doNotShowAgain) {
                await promptState.updateValue(true);
            } else if (selection === Common.install) {
                await this.installExtension(BLACK_EXTENSION);
            }
        } else if (formatter === 'autopep8' && !autopep8) {
            const selection = await appShell.showInformationMessage(
                ToolsExtensions.installAutopep8FormatterPrompt,
                Common.install,
                Common.doNotShowAgain,
            );
            if (selection === Common.doNotShowAgain) {
                await promptState.updateValue(true);
            } else if (selection === Common.install) {
                await this.installExtension(AUTOPEP8_EXTENSION);
            }
        }
    }

    private async installExtension(extensionId: string, resource?: Uri): Promise<void> {
        const appEnv = this.serviceContainer.get<IApplicationEnvironment>(IApplicationEnvironment);
        const commandManager = this.serviceContainer.get<ICommandManager>(ICommandManager);
        await commandManager.executeCommand('workbench.extensions.installExtension', extensionId, {
            installPreReleaseVersion: appEnv.extensionChannel === 'insiders',
        });

        const extension = this.extensions.getExtension(extensionId);
        if (!extension) {
            return;
        }

        await extension.activate();

        const config = this.workspaceService.getConfiguration('editor', resource);
        const scope = this.workspaceService.getWorkspaceFolder(resource)
            ? ConfigurationTarget.Workspace
            : ConfigurationTarget.Global;
        await config.update('defaultFormatter', extensionId, scope, true);
    }
}
