// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { QuickPickItem } from 'vscode';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../../../../common/application/types';
import { Commands } from '../../../../common/constants';
import { IPlatformService } from '../../../../common/platform/types';
import { IConfigurationService, IPathUtils, Resource } from '../../../../common/types';
import { InterpreterQuickPickList } from '../../../../common/utils/localize';
import {
    IMultiStepInput,
    IMultiStepInputFactory,
    InputStep,
    IQuickPickParameters,
} from '../../../../common/utils/multiStepInput';
import { captureTelemetry, sendTelemetryEvent } from '../../../../telemetry';
import { EventName } from '../../../../telemetry/constants';
import { IInterpreterQuickPickItem, IInterpreterSelector, IPythonPathUpdaterServiceManager } from '../../types';
import { BaseInterpreterSelectorCommand } from './base';

export type InterpreterStateArgs = { path?: string; workspace: Resource };
@injectable()
export class SetInterpreterCommand extends BaseInterpreterSelectorCommand {
    constructor(
        @inject(IApplicationShell) applicationShell: IApplicationShell,
        @inject(IPathUtils) private readonly pathUtils: IPathUtils,
        @inject(IPythonPathUpdaterServiceManager)
        pythonPathUpdaterService: IPythonPathUpdaterServiceManager,
        @inject(IConfigurationService) private readonly configurationService: IConfigurationService,
        @inject(ICommandManager) commandManager: ICommandManager,
        @inject(IMultiStepInputFactory) private readonly multiStepFactory: IMultiStepInputFactory,
        @inject(IPlatformService) private readonly platformService: IPlatformService,
        @inject(IInterpreterSelector) private readonly interpreterSelector: IInterpreterSelector,
        @inject(IWorkspaceService) workspaceService: IWorkspaceService,
    ) {
        super(pythonPathUpdaterService, commandManager, applicationShell, workspaceService);
    }

    public async activate() {
        this.disposables.push(
            this.commandManager.registerCommand(Commands.Set_Interpreter, this.setInterpreter.bind(this)),
        );
    }

    public async _pickInterpreter(
        input: IMultiStepInput<InterpreterStateArgs>,
        state: InterpreterStateArgs,
    ): Promise<void | InputStep<InterpreterStateArgs>> {
        const interpreterSuggestions = await this.interpreterSelector.getSuggestions(state.workspace);
        const enterInterpreterPathSuggestion = {
            label: InterpreterQuickPickList.enterPath.label(),
            detail: InterpreterQuickPickList.enterPath.detail(),
            alwaysShow: true,
        };
        const suggestions = [enterInterpreterPathSuggestion, ...interpreterSuggestions];
        const currentPythonPath = this.pathUtils.getDisplayName(
            this.configurationService.getSettings(state.workspace).pythonPath,
            state.workspace ? state.workspace.fsPath : undefined,
        );

        state.path = undefined;
        const selection = await input.showQuickPick<
            IInterpreterQuickPickItem | typeof enterInterpreterPathSuggestion,
            IQuickPickParameters<IInterpreterQuickPickItem | typeof enterInterpreterPathSuggestion>
        >({
            placeholder: InterpreterQuickPickList.quickPickListPlaceholder().format(currentPythonPath),
            items: suggestions,
            activeItem: suggestions[1],
            matchOnDetail: true,
            matchOnDescription: true,
        });

        if (selection === undefined) {
            return;
        } else if (selection.label === enterInterpreterPathSuggestion.label) {
            return this._enterOrBrowseInterpreterPath(input, state);
        } else {
            state.path = (selection as IInterpreterQuickPickItem).path;
        }
    }

    @captureTelemetry(EventName.SELECT_INTERPRETER_ENTER_BUTTON)
    public async _enterOrBrowseInterpreterPath(
        input: IMultiStepInput<InterpreterStateArgs>,
        state: InterpreterStateArgs,
    ): Promise<void | InputStep<InterpreterStateArgs>> {
        const items: QuickPickItem[] = [
            {
                label: InterpreterQuickPickList.browsePath.label(),
                detail: InterpreterQuickPickList.browsePath.detail(),
            },
        ];

        const selection = await input.showQuickPick({
            placeholder: InterpreterQuickPickList.enterPath.placeholder(),
            items,
            acceptFilterBoxTextAsSelection: true,
        });

        if (typeof selection === 'string') {
            // User entered text in the filter box to enter path to python, store it
            sendTelemetryEvent(EventName.SELECT_INTERPRETER_ENTER_CHOICE, undefined, { choice: 'enter' });
            state.path = selection;
        } else if (selection && selection.label === InterpreterQuickPickList.browsePath.label()) {
            sendTelemetryEvent(EventName.SELECT_INTERPRETER_ENTER_CHOICE, undefined, { choice: 'browse' });
            const filtersKey = 'Executables';
            const filtersObject: { [name: string]: string[] } = {};
            filtersObject[filtersKey] = ['exe'];
            const uris = await this.applicationShell.showOpenDialog({
                filters: this.platformService.isWindows ? filtersObject : undefined,
                openLabel: InterpreterQuickPickList.browsePath.openButtonLabel(),
                canSelectMany: false,
                title: InterpreterQuickPickList.browsePath.title(),
            });
            if (uris && uris.length > 0) {
                state.path = uris[0].fsPath;
            }
        }
    }

    @captureTelemetry(EventName.SELECT_INTERPRETER)
    public async setInterpreter() {
        const targetConfig = await this.getConfigTarget();
        if (!targetConfig) {
            return;
        }
        const configTarget = targetConfig.configTarget;
        const wkspace = targetConfig.folderUri;
        const interpreterState: InterpreterStateArgs = { path: undefined, workspace: wkspace };
        const multiStep = this.multiStepFactory.create<InterpreterStateArgs>();
        await multiStep.run((input, s) => this._pickInterpreter(input, s), interpreterState);
        if (interpreterState.path !== undefined) {
            // User may choose to have an empty string stored, so variable `interpreterState.path` may be
            // an empty string, in which case we should update.
            // Having the value `undefined` means user cancelled the quickpick, so we update nothing in that case.
            await this.pythonPathUpdaterService.updatePythonPath(interpreterState.path, configTarget, 'ui', wkspace);
        }
    }
}
