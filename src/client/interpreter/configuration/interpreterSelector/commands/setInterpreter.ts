// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { cloneDeep } from 'lodash';
import * as path from 'path';
import { QuickPickItem } from 'vscode';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../../../../common/application/types';
import { Commands, Octicons } from '../../../../common/constants';
import { IPlatformService } from '../../../../common/platform/types';
import { IConfigurationService, IPathUtils, Resource } from '../../../../common/types';
import { getIcon } from '../../../../common/utils/icons';
import { Common, InterpreterQuickPickList } from '../../../../common/utils/localize';
import {
    IMultiStepInput,
    IMultiStepInputFactory,
    InputStep,
    IQuickPickParameters,
} from '../../../../common/utils/multiStepInput';
import { REFRESH_BUTTON_ICON } from '../../../../debugger/extension/attachQuickPick/types';
import { captureTelemetry, sendTelemetryEvent } from '../../../../telemetry';
import { EventName } from '../../../../telemetry/constants';
import {
    IInterpreterQuickPickItem,
    IInterpreterSelector,
    IPythonPathUpdaterServiceManager,
    ISpecialQuickPickItem,
} from '../../types';
import { BaseInterpreterSelectorCommand } from './base';

const untildify = require('untildify');

export type InterpreterStateArgs = { path?: string; workspace: Resource };
type QuickPickType = IInterpreterQuickPickItem | ISpecialQuickPickItem;

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

    public async activate(): Promise<void> {
        this.disposables.push(
            this.commandManager.registerCommand(Commands.Set_Interpreter, this.setInterpreter.bind(this)),
        );
    }

    public async _pickInterpreter(
        input: IMultiStepInput<InterpreterStateArgs>,
        state: InterpreterStateArgs,
    ): Promise<void | InputStep<InterpreterStateArgs>> {
        const suggestions: QuickPickType[] = [];

        const manualEntrySuggestion: ISpecialQuickPickItem = {
            label: `${Octicons.Add} ${InterpreterQuickPickList.enterPath.label()}`,
            alwaysShow: true,
        };
        suggestions.push(manualEntrySuggestion);

        const config = this.workspaceService.getConfiguration('python', state.workspace);
        const defaultInterpreterPathValue = config.get<string>('defaultInterpreterPath');
        let defaultInterpreterPathSuggestion: ISpecialQuickPickItem | undefined;
        if (defaultInterpreterPathValue && defaultInterpreterPathValue !== 'python') {
            defaultInterpreterPathSuggestion = {
                label: `${Octicons.Gear} ${InterpreterQuickPickList.defaultInterpreterPath.label()}`,
                description: this.pathUtils.getDisplayName(
                    defaultInterpreterPathValue,
                    state.workspace ? state.workspace.fsPath : undefined,
                ),
                path: defaultInterpreterPathValue,
                alwaysShow: true,
            };
            suggestions.push(defaultInterpreterPathSuggestion);
        }

        let interpreterSuggestions = await this.interpreterSelector.getSuggestions(state.workspace);

        if (interpreterSuggestions.length > 0) {
            const suggested = interpreterSuggestions.shift();
            if (suggested) {
                const starred = cloneDeep(suggested);
                starred.label = `${Octicons.Star} ${starred.label}`;
                starred.description = Common.recommended();
                interpreterSuggestions.unshift(starred);
            }
        }
        suggestions.push(...interpreterSuggestions);

        const currentPythonPath = this.pathUtils.getDisplayName(
            this.configurationService.getSettings(state.workspace).pythonPath,
            state.workspace ? state.workspace.fsPath : undefined,
        );

        let activeInterpreter = interpreterSuggestions.filter((i) => i.detail === currentPythonPath);

        state.path = undefined;
        const refreshButton = {
            iconPath: getIcon(REFRESH_BUTTON_ICON),
            tooltip: InterpreterQuickPickList.refreshInterpreterList(),
        };
        const selection = await input.showQuickPick<QuickPickType, IQuickPickParameters<QuickPickType>>({
            placeholder: InterpreterQuickPickList.quickPickListPlaceholder().format(currentPythonPath),
            items: suggestions,
            activeItem: activeInterpreter.length > 0 ? activeInterpreter[0] : interpreterSuggestions[0],
            matchOnDetail: true,
            matchOnDescription: true,
            customButtonSetup: {
                button: refreshButton,
                callback: async (quickPick) => {
                    quickPick.busy = true;

                    interpreterSuggestions = await this.interpreterSelector.getSuggestions(state.workspace, true);
                    if (interpreterSuggestions.length > 0) {
                        const suggested = interpreterSuggestions.shift();
                        if (suggested) {
                            const starred = cloneDeep(suggested);
                            starred.label = `${Octicons.Star} ${starred.label}`;
                            starred.description = Common.recommended();
                            interpreterSuggestions.unshift(starred);
                        }
                    }

                    const newSuggestions = defaultInterpreterPathSuggestion
                        ? [manualEntrySuggestion, defaultInterpreterPathSuggestion, ...interpreterSuggestions]
                        : [manualEntrySuggestion, ...interpreterSuggestions];

                    activeInterpreter = interpreterSuggestions.filter((i) => i.detail === currentPythonPath);

                    quickPick.items = newSuggestions;
                    quickPick.activeItems =
                        activeInterpreter.length > 0 ? [activeInterpreter[0]] : [interpreterSuggestions[0]];

                    quickPick.busy = false;
                },
            },
            title: InterpreterQuickPickList.browsePath.openButtonLabel(),
        });

        if (selection === undefined) {
            sendTelemetryEvent(EventName.SELECT_INTERPRETER_SELECTED, undefined, { action: 'escape' });
        } else if (selection.label === manualEntrySuggestion.label) {
            sendTelemetryEvent(EventName.SELECT_INTERPRETER_ENTER_OR_FIND);
            return this._enterOrBrowseInterpreterPath(input, state, interpreterSuggestions);
        } else {
            sendTelemetryEvent(EventName.SELECT_INTERPRETER_SELECTED, undefined, { action: 'selected' });
            state.path = (selection as IInterpreterQuickPickItem).path;
        }

        return undefined;
    }

    @captureTelemetry(EventName.SELECT_INTERPRETER_ENTER_BUTTON)
    public async _enterOrBrowseInterpreterPath(
        input: IMultiStepInput<InterpreterStateArgs>,
        state: InterpreterStateArgs,
        suggestions: IInterpreterQuickPickItem[],
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
            await this.sendInterpreterEntryTelemetry(selection, state.workspace, suggestions);
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
                await this.sendInterpreterEntryTelemetry(state.path!, state.workspace, suggestions);
            }
        }
    }

    @captureTelemetry(EventName.SELECT_INTERPRETER)
    public async setInterpreter(): Promise<void> {
        const targetConfig = await this.getConfigTarget();
        if (!targetConfig) {
            return;
        }

        const { configTarget } = targetConfig;
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

    /**
     * Check if the interpreter that was entered exists in the list of suggestions.
     * If it does, it means that it had already been discovered,
     * and we didn't do a good job of surfacing it.
     *
     * @param selection Intepreter path that was either entered manually or picked by browsing through the filesystem.
     */
    // eslint-disable-next-line class-methods-use-this
    private async sendInterpreterEntryTelemetry(
        selection: string,
        workspace: Resource,
        suggestions: IInterpreterQuickPickItem[],
    ): Promise<void> {
        let interpreterPath = path.normalize(untildify(selection));

        if (!path.isAbsolute(interpreterPath)) {
            interpreterPath = path.resolve(workspace?.fsPath || '', selection);
        }

        const expandedPaths = suggestions.map((s) => {
            const suggestionPath = s.interpreter.path;
            let expandedPath = path.normalize(untildify(suggestionPath));

            if (!path.isAbsolute(suggestionPath)) {
                expandedPath = path.resolve(workspace?.fsPath || '', suggestionPath);
            }

            return expandedPath;
        });

        const discovered = expandedPaths.includes(interpreterPath);

        sendTelemetryEvent(EventName.SELECT_INTERPRETER_ENTERED_EXISTS, undefined, { discovered });

        return undefined;
    }
}
