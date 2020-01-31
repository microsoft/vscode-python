// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { CssMessages } from '../../../../client/datascience/messages';
import { IDataScienceExtraSettings } from '../../../../client/datascience/types';
import { IMainState } from '../../../interactive-common/mainState';
import { createPostableAction } from '../../../interactive-common/redux/postOffice';
import { Helpers } from '../../../interactive-common/redux/reducers/helpers';
import { ICellAction, ICellAndCursorAction, ICodeAction } from '../../../interactive-common/redux/reducers/types';
import { computeEditorOptions } from '../../../react-common/settingsReactSide';
import { NativeEditorReducerArg } from '../mapping';

export namespace Effects {
    export function focusCell(arg: NativeEditorReducerArg<ICellAndCursorAction>): IMainState {
        // Do nothing if already the focused cell.
        if (arg.prevState.focusedCellId !== arg.payload.data.cellId) {
            let prevState = arg.prevState;

            // First find the old focused cell and unfocus it
            let removeFocusIndex = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.prevState.focusedCellId);
            if (removeFocusIndex < 0) {
                removeFocusIndex = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.prevState.selectedCellId);
            }

            if (removeFocusIndex >= 0) {
                const oldFocusCell = prevState.cellVMs[removeFocusIndex];
                const oldCode = oldFocusCell.uncomittedText || oldFocusCell.inputBlockText;
                prevState = unfocusCell({ ...arg, prevState, payload: { ...arg.payload, data: { cellId: prevState.cellVMs[removeFocusIndex].cell.id, code: oldCode } } });
                prevState = deselectCell({ ...arg, prevState, payload: { ...arg.payload, data: { cellId: prevState.cellVMs[removeFocusIndex].cell.id } } });
            }

            const newVMs = [...prevState.cellVMs];

            // Add focus on new cell
            const addFocusIndex = newVMs.findIndex(c => c.cell.id === arg.payload.data.cellId);
            if (addFocusIndex >= 0) {
                newVMs[addFocusIndex] = { ...newVMs[addFocusIndex], focused: true, selected: true, cursorPos: arg.payload.data.cursorPos };
            }

            return {
                ...prevState,
                cellVMs: newVMs,
                focusedCellId: arg.payload.data.cellId,
                selectedCellId: arg.payload.data.cellId
            };
        }

        return arg.prevState;
    }

    export function unfocusCell(arg: NativeEditorReducerArg<ICodeAction>): IMainState {
        // Unfocus the cell
        const index = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.payload.data.cellId);
        if (index >= 0 && arg.prevState.focusedCellId === arg.payload.data.cellId) {
            const newVMs = [...arg.prevState.cellVMs];
            const current = arg.prevState.cellVMs[index];
            const newCell = {
                ...current,
                inputBlockText: arg.payload.data.code,
                focused: false,
                cell: {
                    ...current.cell,
                    data: {
                        ...current.cell.data,
                        source: arg.payload.data.code
                    }
                }
            };

            // tslint:disable-next-line: no-any
            newVMs[index] = Helpers.asCellViewModel(newCell); // This is because IMessageCell doesn't fit in here

            return {
                ...arg.prevState,
                cellVMs: newVMs,
                focusedCellId: undefined
            };
        } else if (index >= 0) {
            // Dont change focus state if not the focused cell. Just update the code.
            const newVMs = [...arg.prevState.cellVMs];
            const current = arg.prevState.cellVMs[index];
            const newCell = {
                ...current,
                inputBlockText: arg.payload.data.code,
                cell: {
                    ...current.cell,
                    data: {
                        ...current.cell.data,
                        source: arg.payload.data.code
                    }
                }
            };

            // tslint:disable-next-line: no-any
            newVMs[index] = newCell as any; // This is because IMessageCell doesn't fit in here

            return {
                ...arg.prevState,
                cellVMs: newVMs
            };
        }

        return arg.prevState;
    }

    export function deselectCell(arg: NativeEditorReducerArg<ICellAction>): IMainState {
        const index = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.payload.data.cellId);
        if (index >= 0 && arg.prevState.selectedCellId === arg.payload.data.cellId) {
            const newVMs = [...arg.prevState.cellVMs];
            const target = arg.prevState.cellVMs[index];
            const newCell = {
                ...target,
                selected: false
            };

            // tslint:disable-next-line: no-any
            newVMs[index] = newCell as any; // This is because IMessageCell doesn't fit in here

            return {
                ...arg.prevState,
                cellVMs: newVMs,
                selectedCellId: undefined
            };
        }

        return arg.prevState;
    }

    export function selectCell(arg: NativeEditorReducerArg<ICellAndCursorAction>): IMainState {
        // Skip doing anything if already selected.
        if (arg.payload.data.cellId !== arg.prevState.selectedCellId) {
            let prevState = arg.prevState;
            const addIndex = prevState.cellVMs.findIndex(c => c.cell.id === arg.payload.data.cellId);

            // First find the old focused cell and unfocus it
            let removeFocusIndex = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.prevState.focusedCellId);
            if (removeFocusIndex < 0) {
                removeFocusIndex = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.prevState.selectedCellId);
            }

            if (removeFocusIndex >= 0) {
                const oldFocusCell = prevState.cellVMs[removeFocusIndex];
                const oldCode = oldFocusCell.uncomittedText || oldFocusCell.inputBlockText;
                prevState = unfocusCell({ ...arg, prevState, payload: { ...arg.payload, data: { cellId: prevState.cellVMs[removeFocusIndex].cell.id, code: oldCode } } });
                prevState = deselectCell({ ...arg, prevState, payload: { ...arg.payload, data: { cellId: prevState.cellVMs[removeFocusIndex].cell.id } } });
            }

            const newVMs = [...prevState.cellVMs];
            if (addIndex >= 0 && arg.payload.data.cellId !== prevState.selectedCellId) {
                newVMs[addIndex] = {
                    ...newVMs[addIndex],
                    focused: prevState.focusedCellId !== undefined && prevState.focusedCellId === prevState.selectedCellId,
                    selected: true,
                    cursorPos: arg.payload.data.cursorPos
                };
            }

            return {
                ...prevState,
                cellVMs: newVMs,
                focusedCellId: prevState.focusedCellId !== undefined ? arg.payload.data.cellId : undefined,
                selectedCellId: arg.payload.data.cellId
            };
        }
        return arg.prevState;
    }

    export function toggleLineNumbers(arg: NativeEditorReducerArg<ICellAction>): IMainState {
        const index = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.payload.data.cellId);
        if (index >= 0) {
            const newVMs = [...arg.prevState.cellVMs];
            newVMs[index] = { ...newVMs[index], showLineNumbers: !newVMs[index].showLineNumbers };
            return {
                ...arg.prevState,
                cellVMs: newVMs
            };
        }
        return arg.prevState;
    }

    export function toggleOutput(arg: NativeEditorReducerArg<ICellAction>): IMainState {
        const index = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.payload.data.cellId);
        if (index >= 0) {
            const newVMs = [...arg.prevState.cellVMs];
            newVMs[index] = { ...newVMs[index], hideOutput: !newVMs[index].hideOutput };
            return {
                ...arg.prevState,
                cellVMs: newVMs
            };
        }
        return arg.prevState;
    }

    export function updateSettings(arg: NativeEditorReducerArg<string>): IMainState {
        // String arg should be the IDataScienceExtraSettings
        const newSettingsJSON = JSON.parse(arg.payload.data);
        const newSettings = <IDataScienceExtraSettings>newSettingsJSON;
        const newEditorOptions = computeEditorOptions(newSettings);
        const newFontFamily = newSettings.extraSettings ? newSettings.extraSettings.fontFamily : arg.prevState.font.family;
        const newFontSize = newSettings.extraSettings ? newSettings.extraSettings.fontSize : arg.prevState.font.size;

        // Ask for new theme data if necessary
        if (newSettings && newSettings.extraSettings && newSettings.extraSettings.theme !== arg.prevState.vscodeThemeName) {
            const knownDark = Helpers.computeKnownDark(newSettings);
            // User changed the current theme. Rerender
            arg.queueAction(createPostableAction(CssMessages.GetCssRequest, { isDark: knownDark }));
            arg.queueAction(createPostableAction(CssMessages.GetMonacoThemeRequest, { isDark: knownDark }));
        }

        return {
            ...arg.prevState,
            settings: newSettings,
            editorOptions: { ...newEditorOptions, lineDecorationsWidth: 5 },
            font: {
                size: newFontSize,
                family: newFontFamily
            }
        };
    }
}
