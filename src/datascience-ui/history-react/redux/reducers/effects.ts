// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Identifiers } from '../../../../client/datascience/constants';
import { IScrollToCell } from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
import { CssMessages } from '../../../../client/datascience/messages';
import { IDataScienceExtraSettings } from '../../../../client/datascience/types';
import { IMainState } from '../../../interactive-common/mainState';
import { createPostableAction } from '../../../interactive-common/redux/postOffice';
import { Helpers } from '../../../interactive-common/redux/reducers/helpers';
import { ICellAction, IScrollAction } from '../../../interactive-common/redux/reducers/types';
import { computeEditorOptions } from '../../../react-common/settingsReactSide';
import { InteractiveReducerArg } from '../mapping';
import { Creation } from './creation';

export namespace Effects {
    export function expandAll(arg: InteractiveReducerArg): IMainState {
        if (arg.prevState.settings?.showCellInputCode) {
            const newVMs = arg.prevState.cellVMs.map(c =>
                Creation.alterCellVM({ ...c }, arg.prevState.settings, true, true)
            );
            return {
                ...arg.prevState,
                cellVMs: newVMs
            };
        }
        return arg.prevState;
    }

    export function collapseAll(arg: InteractiveReducerArg): IMainState {
        if (arg.prevState.settings?.showCellInputCode) {
            const newVMs = arg.prevState.cellVMs.map(c =>
                Creation.alterCellVM({ ...c }, arg.prevState.settings, true, false)
            );
            return {
                ...arg.prevState,
                cellVMs: newVMs
            };
        }
        return arg.prevState;
    }

    export function toggleInputBlock(arg: InteractiveReducerArg<ICellAction>): IMainState {
        if (arg.payload.cellId) {
            const newVMs = [...arg.prevState.cellVMs];
            const index = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.payload.cellId);
            const oldVM = arg.prevState.cellVMs[index];
            newVMs[index] = Creation.alterCellVM({ ...oldVM }, arg.prevState.settings, true, !oldVM.inputBlockOpen);
            return {
                ...arg.prevState,
                cellVMs: newVMs
            };
        }
        return arg.prevState;
    }

    export function updateSettings(arg: InteractiveReducerArg<string>): IMainState {
        // String arg should be the IDataScienceExtraSettings
        const newSettingsJSON = JSON.parse(arg.payload);
        const newSettings = <IDataScienceExtraSettings>newSettingsJSON;
        const newEditorOptions = computeEditorOptions(newSettings);
        const newFontFamily = newSettings.extraSettings
            ? newSettings.extraSettings.fontFamily
            : arg.prevState.font.family;
        const newFontSize = newSettings.extraSettings ? newSettings.extraSettings.fontSize : arg.prevState.font.size;

        // Ask for new theme data if necessary
        if (
            newSettings &&
            newSettings.extraSettings &&
            newSettings.extraSettings.theme !== arg.prevState.vscodeThemeName
        ) {
            const knownDark = Helpers.computeKnownDark(newSettings);
            // User changed the current theme. Rerender
            arg.queueAction(createPostableAction(CssMessages.GetCssRequest, { isDark: knownDark }));
            arg.queueAction(createPostableAction(CssMessages.GetMonacoThemeRequest, { isDark: knownDark }));
        }

        // Update our input cell state if the user changed this setting
        let newVMs = arg.prevState.cellVMs;
        if (newSettings.showCellInputCode !== arg.prevState.settings?.showCellInputCode) {
            newVMs = arg.prevState.cellVMs.map(c =>
                Creation.alterCellVM(
                    c,
                    newSettings,
                    newSettings.showCellInputCode,
                    !newSettings.collapseCellInputCodeByDefault
                )
            );
        }

        return {
            ...arg.prevState,
            cellVMs: newVMs,
            settings: newSettings,
            editorOptions: newEditorOptions,
            font: {
                size: newFontSize,
                family: newFontFamily
            }
        };
    }

    export function scrollToCell(arg: InteractiveReducerArg<IScrollToCell>): IMainState {
        // Up the scroll count on the necessary cell
        const index = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.payload.id);
        if (index >= 0) {
            const newVMs = [...arg.prevState.cellVMs];

            // Scroll one cell and unscroll another.
            newVMs[index] = { ...newVMs[index], scrollCount: newVMs[index].scrollCount + 1 };
            return {
                ...arg.prevState,
                cellVMs: newVMs,
                isAtBottom: false
            };
        }

        return arg.prevState;
    }

    export function scrolled(arg: InteractiveReducerArg<IScrollAction>): IMainState {
        return {
            ...arg.prevState,
            isAtBottom: arg.payload.isAtBottom
        };
    }

    export function clickCell(arg: InteractiveReducerArg<ICellAction>): IMainState {
        if (
            arg.payload.cellId === Identifiers.EditCellId &&
            arg.prevState.editCellVM &&
            !arg.prevState.editCellVM.focused
        ) {
            return {
                ...arg.prevState,
                editCellVM: {
                    ...arg.prevState.editCellVM,
                    focused: true
                }
            };
        } else if (arg.prevState.editCellVM) {
            return {
                ...arg.prevState,
                editCellVM: {
                    ...arg.prevState.editCellVM,
                    focused: false
                }
            };
        }

        return arg.prevState;
    }

    export function unfocusCell(arg: InteractiveReducerArg<ICellAction>): IMainState {
        if (
            arg.payload.cellId === Identifiers.EditCellId &&
            arg.prevState.editCellVM &&
            arg.prevState.editCellVM.focused
        ) {
            return {
                ...arg.prevState,
                editCellVM: {
                    ...arg.prevState.editCellVM,
                    focused: false
                }
            };
        }

        return arg.prevState;
    }
}
