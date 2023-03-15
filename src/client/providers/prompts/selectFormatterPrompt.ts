// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ConfigurationTarget, Uri } from 'vscode';
import { IApplicationShell, IWorkspaceService } from '../../common/application/types';
import { ShowFormatterExtensionPrompt } from '../../common/experiments/groups';
import { IExperimentService, IExtensions, IPersistentStateFactory } from '../../common/types';
import { Common, ToolsExtensions } from '../../common/utils/localize';
import { IServiceContainer } from '../../ioc/types';
import { traceVerbose } from '../../logging';
import { AUTOPEP8_EXTENSION, BLACK_EXTENSION, ISelectFormatterPrompt } from './types';

const SELECT_FORMATTER_PROMPT_DONOTSHOW_KEY = 'showSelectFormatterExtensionPrompt';

export class SelectFormatterPrompt implements ISelectFormatterPrompt {
    private shownThisSession = false;

    constructor(private readonly serviceContainer: IServiceContainer) {}

    public async showSelectFormatterPrompt(resource?: Uri): Promise<void> {
        const experiment = this.serviceContainer.get<IExperimentService>(IExperimentService);
        if (!(await experiment.inExperiment(ShowFormatterExtensionPrompt.experiment))) {
            return;
        }

        const persistFactory = this.serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
        const promptState = persistFactory.createWorkspacePersistentState<boolean>(
            SELECT_FORMATTER_PROMPT_DONOTSHOW_KEY,
            false,
        );
        if (this.shownThisSession || promptState.value) {
            return;
        }

        const extensions = this.serviceContainer.get<IExtensions>(IExtensions);
        const black = extensions.getExtension(BLACK_EXTENSION);
        const autopep8 = extensions.getExtension(AUTOPEP8_EXTENSION);
        if (!black && !autopep8) {
            return;
        }

        const workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        const scope = workspaceService.getWorkspaceFolder(resource)
            ? ConfigurationTarget.Workspace
            : ConfigurationTarget.Global;
        const config = workspaceService.getConfiguration('editor', resource);
        const defaultFormatter = config.get<string>('defaultFormatter');
        if (defaultFormatter !== 'ms-python.python') {
            traceVerbose(`Not showing select formatter prompt, 'editor.defaultFormatter' set to ${defaultFormatter}`);
            return;
        }

        this.shownThisSession = true;
        const appShell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
        let selection: string | undefined;

        if (black && autopep8) {
            selection = await appShell.showInformationMessage(
                ToolsExtensions.selectMultipleFormattersPrompt,
                'Black',
                'Autopep8',
                Common.doNotShowAgain,
            );
        } else if (black) {
            selection = await appShell.showInformationMessage(
                ToolsExtensions.selectBlackFormatterPrompt,
                Common.bannerLabelYes,
                Common.doNotShowAgain,
            );
            if (selection === Common.bannerLabelYes) {
                selection = 'Black';
            }
        } else if (autopep8) {
            selection = await appShell.showInformationMessage(
                ToolsExtensions.selectAutopep8FormatterPrompt,
                Common.bannerLabelYes,
                Common.doNotShowAgain,
            );
            if (selection === Common.bannerLabelYes) {
                selection = 'Autopep8';
            }
        }

        if (selection === 'Black') {
            await config.update('defaultFormatter', BLACK_EXTENSION, scope, true);
        } else if (selection === 'Autopep8') {
            await config.update('defaultFormatter', AUTOPEP8_EXTENSION, scope, true);
        } else if (selection === Common.doNotShowAgain) {
            await promptState.updateValue(true);
        }
    }
}
