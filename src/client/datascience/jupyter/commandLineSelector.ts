// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
// tslint:disable-next-line: import-name
import parseArgsStringToArgv from 'string-argv';
import { ConfigurationChangeEvent, ConfigurationTarget, QuickPickItem } from 'vscode';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../../common/application/types';
import { IConfigurationService } from '../../common/types';
import { DataScience } from '../../common/utils/localize';
import {
    IMultiStepInput,
    IMultiStepInputFactory,
    InputStep,
    IQuickPickParameters
} from '../../common/utils/multiStepInput';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { Telemetry } from '../constants';

@injectable()
export class JupyterCommandLineSelector {
    private readonly defaultLabel = `$(zap) ${DataScience.jupyterCommandLineDefaultLabel()}`;
    private readonly customLabel = `$(gear) ${DataScience.jupyterCommandLineCustomLabel()}`;
    constructor(
        @inject(IMultiStepInputFactory) private readonly multiStepFactory: IMultiStepInputFactory,
        @inject(IConfigurationService) private configuration: IConfigurationService,
        @inject(IWorkspaceService) workspaceService: IWorkspaceService,
        @inject(IApplicationShell) private appShell: IApplicationShell,
        @inject(ICommandManager) private commandManager: ICommandManager
    ) {
        workspaceService.onDidChangeConfiguration(this.onDidChangeConfiguration.bind(this));
    }

    @captureTelemetry(Telemetry.SelectJupyterURI)
    public selectJupyterCommandLine(): Promise<void> {
        const multiStep = this.multiStepFactory.create<{}>();
        return multiStep.run(this.startSelectingCommandLine.bind(this), {});
    }

    private async onDidChangeConfiguration(e: ConfigurationChangeEvent) {
        if (e.affectsConfiguration('python.dataScience.jupyterCommandLineArguments')) {
            const reload = DataScience.jupyterCommandLineReloadAnswer();
            const item = await this.appShell.showInformationMessage(
                DataScience.jupyterCommandLineReloadQuestion(),
                reload
            );
            if (item === reload) {
                this.commandManager.executeCommand('workbench.action.reloadWindow');
            }
        }
    }

    private async startSelectingCommandLine(input: IMultiStepInput<{}>, _state: {}): Promise<InputStep<{}> | void> {
        // First step, show a quick pick to choose either the custom or the default.
        // newChoice element will be set if the user picked 'enter a new server'
        const item = await input.showQuickPick<QuickPickItem, IQuickPickParameters<QuickPickItem>>({
            placeholder: DataScience.jupyterCommandLineQuickPickPlaceholder(),
            items: this.getPickList(),
            title: DataScience.jupyterCommandLineQuickPickTitle()
        });
        if (item.label === this.defaultLabel) {
            await this.setJupyterCommandLine('');
        } else {
            return this.selectCustomCommandLine.bind(this);
        }
    }
    private async selectCustomCommandLine(input: IMultiStepInput<{}>, _state: {}): Promise<InputStep<{}> | void> {
        // Ask the user to enter a command line
        const result = await input.showInputBox({
            title: DataScience.jupyterCommandLinePrompt(),
            value: this.configuration.getSettings().datascience.jupyterCommandLineArguments.join(' '),
            validate: this.validate,
            prompt: ''
        });

        if (result) {
            await this.setJupyterCommandLine(result);
        }
    }

    private async setJupyterCommandLine(val: string): Promise<void> {
        if (val) {
            sendTelemetryEvent(Telemetry.JupyterCommandLineNonDefault);
        }
        const split = parseArgsStringToArgv(val);
        await this.configuration.updateSetting(
            'dataScience.jupyterCommandLineArguments',
            split,
            undefined,
            ConfigurationTarget.Workspace
        );
    }

    private validate = async (_inputText: string): Promise<string | undefined> => {
        return undefined;
    };

    private getPickList(): QuickPickItem[] {
        // Always have 'local' and 'custom'
        const items: QuickPickItem[] = [];
        items.push({ label: this.defaultLabel, detail: DataScience.jupyterCommandLineDefaultDetail() });
        items.push({ label: this.customLabel, detail: DataScience.jupyterCommandLineCustomDetail() });

        return items;
    }
}
