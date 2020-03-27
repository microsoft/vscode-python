// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { CssMessages } from '../../../../client/datascience/messages';
import { IDataScienceExtraSettings } from '../../../../client/datascience/types';
import { getSelectedAndFocusedInfo, IMainState } from '../../../interactive-common/mainState';
import { postActionToExtension } from '../../../interactive-common/redux/helpers';
import { Helpers } from '../../../interactive-common/redux/reducers/helpers';
import { ICellAction, ICellAndCursorAction } from '../../../interactive-common/redux/reducers/types';
import { computeEditorOptions } from '../../../react-common/settingsReactSide';
import { NativeEditorReducerArg } from '../mapping';

export namespace Effects {
    export function focusCell(arg: NativeEditorReducerArg<ICellAndCursorAction>): IMainState {
        // Do nothing if already the focused cell.
        let selectionInfo = getSelectedAndFocusedInfo(arg.prevState);
        if (selectionInfo.focusedCellId !== arg.payload.data.cellId) {
            let prevState = arg.prevState;

            // Ensure we unfocus & unselect all cells.
            while (selectionInfo.focusedCellId || selectionInfo.selectedCellId) {
                selectionInfo = getSelectedAndFocusedInfo(prevState);
                // First find the old focused cell and unfocus it
                let removeFocusIndex = selectionInfo.focusedCellIndex;
                if (typeof removeFocusIndex !== 'number') {
                    removeFocusIndex = selectionInfo.selectedCellIndex;
                }

                if (typeof removeFocusIndex === 'number') {
                    prevState = unfocusCell({
                        ...arg,
                        prevState,
                        payload: {
                            ...arg.payload,
                            data: { cellId: prevState.cellVMs[removeFocusIndex].cell.id }
                        }
                    });
                    prevState = deselectCell({
                        ...arg,
                        prevState,
                        payload: { ...arg.payload, data: { cellId: prevState.cellVMs[removeFocusIndex].cell.id } }
                    });
                }
            }

            const newVMs = [...prevState.cellVMs];

            // Add focus on new cell
            const addFocusIndex = newVMs.findIndex((c) => c.cell.id === arg.payload.data.cellId);
            if (addFocusIndex >= 0) {
                newVMs[addFocusIndex] = {
                    ...newVMs[addFocusIndex],
                    focused: true,
                    selected: true,
                    cursorPos: arg.payload.data.cursorPos
                };
            }

            return {
                ...prevState,
                cellVMs: newVMs
            };
        }

        return arg.prevState;
    }

    export function unfocusCell(arg: NativeEditorReducerArg<ICellAction>): IMainState {
        // Unfocus the cell
        const index = arg.prevState.cellVMs.findIndex((c) => c.cell.id === arg.payload.data.cellId);
        const selectionInfo = getSelectedAndFocusedInfo(arg.prevState);
        if (index >= 0 && selectionInfo.focusedCellId === arg.payload.data.cellId) {
            const newVMs = [...arg.prevState.cellVMs];
            const current = arg.prevState.cellVMs[index];
            const newCell = {
                ...current,
                focused: false
            };

            // tslint:disable-next-line: no-any
            newVMs[index] = Helpers.asCellViewModel(newCell); // This is because IMessageCell doesn't fit in here

            return {
                ...arg.prevState,
                cellVMs: newVMs
            };
        } else if (index >= 0) {
            // Dont change focus state if not the focused cell. Just update the code.
            const newVMs = [...arg.prevState.cellVMs];
            const current = arg.prevState.cellVMs[index];
            const newCell = {
                ...current
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
        const index = arg.prevState.cellVMs.findIndex((c) => c.cell.id === arg.payload.data.cellId);
        const selectionInfo = getSelectedAndFocusedInfo(arg.prevState);
        if (index >= 0 && selectionInfo.selectedCellId === arg.payload.data.cellId) {
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
                cellVMs: newVMs
            };
        }

        return arg.prevState;
    }

    /**
     * Select a cell.
     *
     * @param {boolean} [shouldFocusCell] If provided, then will control the focus behavior of the cell. (defaults to focus state of previously selected cell).
     */
    export function selectCell(
        arg: NativeEditorReducerArg<ICellAndCursorAction>,
        shouldFocusCell?: boolean
    ): IMainState {
        // Skip doing anything if already selected.
        const selectionInfo = getSelectedAndFocusedInfo(arg.prevState);
        if (arg.payload.data.cellId !== selectionInfo.selectedCellId) {
            let prevState = arg.prevState;
            const addIndex = prevState.cellVMs.findIndex((c) => c.cell.id === arg.payload.data.cellId);
            const someOtherCellWasFocusedAndSelected =
                selectionInfo.focusedCellId === selectionInfo.selectedCellId && !!selectionInfo.focusedCellId;
            // First find the old focused cell and unfocus it
            let removeFocusIndex = arg.prevState.cellVMs.findIndex((c) => c.cell.id === selectionInfo.focusedCellId);
            if (removeFocusIndex < 0) {
                removeFocusIndex = arg.prevState.cellVMs.findIndex((c) => c.cell.id === selectionInfo.selectedCellId);
            }

            if (removeFocusIndex >= 0) {
                prevState = unfocusCell({
                    ...arg,
                    prevState,
                    payload: {
                        ...arg.payload,
                        data: { cellId: prevState.cellVMs[removeFocusIndex].cell.id }
                    }
                });
                prevState = deselectCell({
                    ...arg,
                    prevState,
                    payload: { ...arg.payload, data: { cellId: prevState.cellVMs[removeFocusIndex].cell.id } }
                });
            }

            const newVMs = [...prevState.cellVMs];
            if (addIndex >= 0 && arg.payload.data.cellId !== selectionInfo.selectedCellId) {
                newVMs[addIndex] = {
                    ...newVMs[addIndex],
                    focused:
                        typeof shouldFocusCell === 'boolean' ? shouldFocusCell : someOtherCellWasFocusedAndSelected,
                    selected: true,
                    cursorPos: arg.payload.data.cursorPos
                };
            }

            return {
                ...prevState,
                cellVMs: newVMs
            };
        }
        return arg.prevState;
    }

    export function toggleLineNumbers(arg: NativeEditorReducerArg<ICellAction>): IMainState {
        const index = arg.prevState.cellVMs.findIndex((c) => c.cell.id === arg.payload.data.cellId);
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
        const index = arg.prevState.cellVMs.findIndex((c) => c.cell.id === arg.payload.data.cellId);
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
        const newFontFamily = newSettings.extraSettings
            ? newSettings.extraSettings.editor.fontFamily
            : arg.prevState.font.family;
        const newFontSize = newSettings.extraSettings
            ? newSettings.extraSettings.editor.fontSize
            : arg.prevState.font.size;

        // Ask for new theme data if necessary
        if (
            newSettings &&
            newSettings.extraSettings &&
            newSettings.extraSettings.theme !== arg.prevState.vscodeThemeName
        ) {
            const knownDark = Helpers.computeKnownDark(newSettings);
            // User changed the current theme. Rerender
            postActionToExtension(arg, CssMessages.GetCssRequest, { isDark: knownDark });
            postActionToExtension(arg, CssMessages.GetMonacoThemeRequest, { isDark: knownDark });
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
