// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { cloneDeep } from 'lodash';
import * as path from 'path';
import { QuickPick, QuickPickItem, QuickPickItemKind } from 'vscode';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../../../../common/application/types';
import { Commands, Octicons } from '../../../../common/constants';
import { arePathsSame, isParentPath } from '../../../../common/platform/fs-paths';
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
import { SystemVariables } from '../../../../common/variables/systemVariables';
import { REFRESH_BUTTON_ICON } from '../../../../debugger/extension/attachQuickPick/types';
import { EnvironmentType } from '../../../../pythonEnvironments/info';
import { captureTelemetry, sendTelemetryEvent } from '../../../../telemetry';
import { EventName } from '../../../../telemetry/constants';
import { IInterpreterService, PythonEnvironmentsChangedEvent } from '../../../contracts';
import {
    IInterpreterQuickPickItem,
    IInterpreterSelector,
    IPythonPathUpdaterServiceManager,
    ISpecialQuickPickItem,
} from '../../types';
import { BaseInterpreterSelectorCommand } from './base';

const untildify = require('untildify');

export type InterpreterStateArgs = { path?: string; workspace: Resource };
type QuickPickType = IInterpreterQuickPickItem | ISpecialQuickPickItem | QuickPickItem;

function isInterpreterQuickPickItem(item: QuickPickType): item is IInterpreterQuickPickItem {
    return 'interpreter' in item;
}

function isSpecialQuickPickItem(item: QuickPickType): item is ISpecialQuickPickItem {
    return 'alwaysShow' in item;
}

function isSeparatorItem(item: QuickPickType): item is QuickPickItem {
    return 'kind' in item && item.kind === QuickPickItemKind.Separator;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace EnvGroups {
    export const Workspace = InterpreterQuickPickList.workspaceGroupName();
    export const Conda = 'Conda';
    export const Global = InterpreterQuickPickList.globalGroupName();
    export const VirtualEnv = 'VirtualEnv';
    export const PipEnv = 'PipEnv';
    export const Pyenv = 'Pyenv';
    export const Venv = 'Venv';
    export const Poetry = 'Poetry';
    export const VirtualEnvWrapper = 'VirtualEnvWrapper';
    export const Recommended = Common.recommended();
}
@injectable()
export class SetInterpreterCommand extends BaseInterpreterSelectorCommand {
    private readonly manualEntrySuggestion: ISpecialQuickPickItem = {
        label: `${Octicons.Add} ${InterpreterQuickPickList.enterPath.label()}`,
        alwaysShow: true,
    };

    constructor(
        @inject(IApplicationShell) applicationShell: IApplicationShell,
        @inject(IPathUtils) pathUtils: IPathUtils,
        @inject(IPythonPathUpdaterServiceManager)
        pythonPathUpdaterService: IPythonPathUpdaterServiceManager,
        @inject(IConfigurationService) configurationService: IConfigurationService,
        @inject(ICommandManager) commandManager: ICommandManager,
        @inject(IMultiStepInputFactory) private readonly multiStepFactory: IMultiStepInputFactory,
        @inject(IPlatformService) private readonly platformService: IPlatformService,
        @inject(IInterpreterSelector) private readonly interpreterSelector: IInterpreterSelector,
        @inject(IWorkspaceService) workspaceService: IWorkspaceService,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
    ) {
        super(
            pythonPathUpdaterService,
            commandManager,
            applicationShell,
            workspaceService,
            pathUtils,
            configurationService,
        );
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
        // If the list is refreshing, it's crucial to maintain sorting order at all
        // times so that the visible items do not change.
        const preserveOrderWhenFiltering = !!this.interpreterService.refreshPromise;
        const suggestions = this.getItems(state.workspace);
        state.path = undefined;
        const currentInterpreterPathDisplay = this.pathUtils.getDisplayName(
            this.configurationService.getSettings(state.workspace).pythonPath,
            state.workspace ? state.workspace.fsPath : undefined,
        );
        const selection = await input.showQuickPick<QuickPickType, IQuickPickParameters<QuickPickType>>({
            placeholder: InterpreterQuickPickList.quickPickListPlaceholder().format(currentInterpreterPathDisplay),
            items: suggestions,
            sortByLabel: !preserveOrderWhenFiltering,
            keepScrollPosition: true,
            activeItem: this.getActiveItem(state.workspace, suggestions),
            matchOnDetail: true,
            matchOnDescription: true,
            title: InterpreterQuickPickList.browsePath.openButtonLabel(),
            customButtonSetup: {
                button: {
                    iconPath: getIcon(REFRESH_BUTTON_ICON),
                    tooltip: InterpreterQuickPickList.refreshInterpreterList(),
                },
                callback: () => this.interpreterService.triggerRefresh().ignoreErrors(),
            },
            onChangeItem: {
                event: this.interpreterService.onDidChangeInterpreters,
                // It's essential that each callback is handled synchronously, as result of the previous
                // callback influences the input for the next one. Input here is the quickpick itself.
                callback: (event: PythonEnvironmentsChangedEvent, quickPick) => {
                    if (this.interpreterService.refreshPromise) {
                        quickPick.busy = true;
                        this.interpreterService.refreshPromise.then(() => {
                            // Items are in the final state as all previous callbacks have finished executing.
                            quickPick.busy = false;
                            // Ensure we set a recommended item after refresh has finished.
                            this.updateQuickPickItems(quickPick, {}, state.workspace);
                        });
                    }
                    this.updateQuickPickItems(quickPick, event, state.workspace);
                },
            },
        });

        if (selection === undefined) {
            sendTelemetryEvent(EventName.SELECT_INTERPRETER_SELECTED, undefined, { action: 'escape' });
        } else if (selection.label === this.manualEntrySuggestion.label) {
            sendTelemetryEvent(EventName.SELECT_INTERPRETER_ENTER_OR_FIND);
            return this._enterOrBrowseInterpreterPath(input, state, suggestions);
        } else {
            sendTelemetryEvent(EventName.SELECT_INTERPRETER_SELECTED, undefined, { action: 'selected' });
            state.path = (selection as IInterpreterQuickPickItem).path;
        }

        return undefined;
    }

    private getItems(resource: Resource) {
        const suggestions: QuickPickType[] = [this.manualEntrySuggestion];
        const defaultInterpreterPathSuggestion = this.getDefaultInterpreterPathSuggestion(resource);
        if (defaultInterpreterPathSuggestion) {
            suggestions.push(defaultInterpreterPathSuggestion);
        }
        const interpreterSuggestions = this.getSuggestions(resource);
        this.setRecommendedItem(interpreterSuggestions, resource);
        suggestions.push(...interpreterSuggestions);
        return suggestions;
    }

    private getSuggestions(resource: Resource): QuickPickType[] {
        const workspaceFolder = this.workspaceService.getWorkspaceFolder(resource);
        const items = this.interpreterSelector.getSuggestions(resource, !!this.interpreterService.refreshPromise);
        if (this.interpreterService.refreshPromise) {
            // We cannot put items in groups while the list is loading as group of an item can change.
            return items;
        }
        const itemsWithFullName = this.interpreterSelector.getSuggestions(resource, true);
        const recommended = this.interpreterSelector.getRecommendedSuggestion(
            itemsWithFullName,
            this.workspaceService.getWorkspaceFolder(resource)?.uri,
        );
        if (recommended && arePathsSame(items[0].interpreter.path, recommended.interpreter.path)) {
            items.shift();
        }
        return getGroupedQuickPickItems(items, recommended, workspaceFolder?.uri.fsPath);
    }

    private getActiveItem(resource: Resource, suggestions: QuickPickType[]) {
        const currentPythonPath = this.configurationService.getSettings(resource).pythonPath;
        const activeInterpreter = suggestions.filter(
            (i) => isInterpreterQuickPickItem(i) && i.path === currentPythonPath,
        );
        if (activeInterpreter.length > 0) {
            return activeInterpreter[0];
        }
        const firstInterpreterSuggestion = suggestions.find((s) => isInterpreterQuickPickItem(s));
        if (firstInterpreterSuggestion) {
            return firstInterpreterSuggestion;
        }
        return suggestions[0];
    }

    private getDefaultInterpreterPathSuggestion(resource: Resource): ISpecialQuickPickItem | undefined {
        const config = this.workspaceService.getConfiguration('python', resource);
        const systemVariables = new SystemVariables(resource, undefined, this.workspaceService);
        const defaultInterpreterPathValue = systemVariables.resolveAny(config.get<string>('defaultInterpreterPath'));
        if (defaultInterpreterPathValue && defaultInterpreterPathValue !== 'python') {
            return {
                label: `${Octicons.Gear} ${InterpreterQuickPickList.defaultInterpreterPath.label()}`,
                description: this.pathUtils.getDisplayName(
                    defaultInterpreterPathValue,
                    resource ? resource.fsPath : undefined,
                ),
                path: defaultInterpreterPathValue,
                alwaysShow: true,
            };
        }
        return undefined;
    }

    /**
     * Updates quickpick using the change event received.
     */
    private updateQuickPickItems(
        quickPick: QuickPick<QuickPickType>,
        event: PythonEnvironmentsChangedEvent,
        resource: Resource,
    ) {
        // Active items are reset once we replace the current list with updated items, so save it.
        const activeItemBeforeUpdate = quickPick.activeItems.length > 0 ? quickPick.activeItems[0] : undefined;
        quickPick.items = this.getUpdatedItems(quickPick.items, event, resource);
        // Ensure we maintain the same active item as before.
        const activeItem = activeItemBeforeUpdate
            ? quickPick.items.find((item) => {
                  if (isInterpreterQuickPickItem(item) && isInterpreterQuickPickItem(activeItemBeforeUpdate)) {
                      return arePathsSame(item.interpreter.path, activeItemBeforeUpdate.interpreter.path);
                  }
                  if (isSpecialQuickPickItem(item) && isSpecialQuickPickItem(activeItemBeforeUpdate)) {
                      // 'label' is a constant here instead of 'path'.
                      return item.label === activeItemBeforeUpdate.label;
                  }
                  return false;
              })
            : undefined;
        quickPick.activeItems = activeItem ? [activeItem] : [];
    }

    /**
     * Prepare updated items to replace the quickpick list with.
     */
    private getUpdatedItems(
        items: readonly QuickPickType[],
        event: PythonEnvironmentsChangedEvent,
        resource: Resource,
    ): QuickPickType[] {
        const updatedItems = [...items.values()];
        const areItemsGrouped = items.find((item) => isSeparatorItem(item));
        const env = event.old ?? event.new;
        let envIndex = -1;
        if (env) {
            envIndex = updatedItems.findIndex(
                (item) => isInterpreterQuickPickItem(item) && arePathsSame(item.interpreter.path, env.path),
            );
        }
        if (event.new) {
            const newSuggestion = this.interpreterSelector.suggestionToQuickPickItem(
                event.new,
                resource,
                !areItemsGrouped,
            );
            if (envIndex === -1) {
                if (areItemsGrouped) {
                    addSeparatorIfApplicable(
                        updatedItems,
                        newSuggestion,
                        this.workspaceService.getWorkspaceFolder(resource)?.uri.fsPath,
                    );
                }
                updatedItems.push(newSuggestion);
            } else {
                updatedItems[envIndex] = newSuggestion;
            }
        }
        if (envIndex !== -1 && event.new === undefined) {
            updatedItems.splice(envIndex, 1);
        }
        this.setRecommendedItem(updatedItems, resource);
        return updatedItems;
    }

    private setRecommendedItem(items: QuickPickType[], resource: Resource) {
        const interpreterSuggestions = this.interpreterSelector.getSuggestions(resource, true);
        if (!this.interpreterService.refreshPromise && interpreterSuggestions.length > 0) {
            const suggestion = this.interpreterSelector.getRecommendedSuggestion(
                interpreterSuggestions,
                this.workspaceService.getWorkspaceFolder(resource)?.uri,
            );
            if (!suggestion) {
                return;
            }
            const areItemsGrouped = items.find((item) => isSeparatorItem(item) && item.label === EnvGroups.Recommended);
            const recommended = cloneDeep(suggestion);
            recommended.label = `${Octicons.Star} ${recommended.label}`;
            recommended.description = areItemsGrouped
                ? // No need to add a tag as "Recommended" group already exists.
                  recommended.description
                : `${recommended.description ?? ''} - ${Common.recommended()}`;
            const index = items.findIndex(
                (item) =>
                    isInterpreterQuickPickItem(item) &&
                    arePathsSame(item.interpreter.path, recommended.interpreter.path),
            );
            if (index !== -1) {
                items[index] = recommended;
            }
        }
    }

    @captureTelemetry(EventName.SELECT_INTERPRETER_ENTER_BUTTON)
    public async _enterOrBrowseInterpreterPath(
        input: IMultiStepInput<InterpreterStateArgs>,
        state: InterpreterStateArgs,
        suggestions: QuickPickType[],
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
            this.sendInterpreterEntryTelemetry(selection, state.workspace, suggestions);
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
                this.sendInterpreterEntryTelemetry(state.path!, state.workspace, suggestions);
            }
        }
    }

    @captureTelemetry(EventName.SELECT_INTERPRETER)
    public async setInterpreter(): Promise<void> {
        const targetConfig = await this.getConfigTargets();
        if (!targetConfig) {
            return;
        }

        const { configTarget } = targetConfig[0];
        const wkspace = targetConfig[0].folderUri;
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
    private sendInterpreterEntryTelemetry(selection: string, workspace: Resource, suggestions: QuickPickType[]): void {
        let interpreterPath = path.normalize(untildify(selection));

        if (!path.isAbsolute(interpreterPath)) {
            interpreterPath = path.resolve(workspace?.fsPath || '', selection);
        }

        const expandedPaths = suggestions.map((s) => {
            const suggestionPath = isInterpreterQuickPickItem(s) ? s.interpreter.path : '';
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

function getGroupedQuickPickItems(
    items: IInterpreterQuickPickItem[],
    recommended: IInterpreterQuickPickItem | undefined,
    workspacePath?: string,
): QuickPickType[] {
    const updatedItems: QuickPickType[] = [];
    if (recommended) {
        updatedItems.push({ label: EnvGroups.Recommended, kind: QuickPickItemKind.Separator }, recommended);
    }
    let previousGroup = EnvGroups.Recommended;
    for (const item of items) {
        previousGroup = addSeparatorIfApplicable(updatedItems, item, workspacePath, previousGroup);
        updatedItems.push(item);
    }
    return updatedItems;
}

function addSeparatorIfApplicable(
    items: QuickPickType[],
    newItem: IInterpreterQuickPickItem,
    workspacePath?: string,
    previousGroup?: string | undefined,
) {
    if (!previousGroup) {
        const lastItem = items.length ? items[items.length - 1] : undefined;
        previousGroup =
            lastItem && isInterpreterQuickPickItem(lastItem) ? getGroup(lastItem, workspacePath) : undefined;
    }
    const currentGroup = getGroup(newItem, workspacePath);
    if (!previousGroup || currentGroup !== previousGroup) {
        const separatorItem: QuickPickItem = { label: currentGroup, kind: QuickPickItemKind.Separator };
        items.push(separatorItem);
        previousGroup = currentGroup;
    }
    return previousGroup;
}

function getGroup(item: IInterpreterQuickPickItem, workspacePath?: string) {
    if (workspacePath && isParentPath(item.path, workspacePath)) {
        return EnvGroups.Workspace;
    }
    switch (item.interpreter.envType) {
        case EnvironmentType.Global:
        case EnvironmentType.System:
        case EnvironmentType.Unknown:
        case EnvironmentType.WindowsStore:
            return EnvGroups.Global;
        default:
            return EnvGroups[item.interpreter.envType];
    }
}
