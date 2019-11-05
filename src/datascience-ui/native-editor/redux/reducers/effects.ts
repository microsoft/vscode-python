// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Identifiers } from '../../../../client/datascience/constants';
import { CssMessages, IGetCssResponse } from '../../../../client/datascience/messages';
import { IGetMonacoThemeResponse } from '../../../../client/datascience/monacoMessages';
import { IDataScienceExtraSettings } from '../../../../client/datascience/types';
import { CursorPos, IMainState } from '../../../interactive-common/mainState';
import { computeEditorOptions } from '../../../react-common/settingsReactSide';
import { ICellAction, ICellAndCursorAction, ICodeAction } from '../actions';
import { NativeEditorReducerArg } from '../mapping';
import { Helpers } from '../../../interactive-common/redux/reducers/helpers';

export namespace Effects {

    export function focusCell(arg: NativeEditorReducerArg<ICellAndCursorAction>): IMainState {
        const newVMs = [...arg.prevState.cellVMs];

        // Focus one cell and unfocus another. Focus should always gain selection too.
        const addFocusIndex = newVMs.findIndex(c => c.cell.id === arg.payload.cellId);
        let removeFocusIndex = newVMs.findIndex(c => c.cell.id === arg.prevState.focusedCellId);
        if (removeFocusIndex < 0) {
            removeFocusIndex = newVMs.findIndex(c => c.cell.id === arg.prevState.selectedCellId);
        }
        if (addFocusIndex >= 0) {
            newVMs[addFocusIndex] = { ...newVMs[addFocusIndex], focused: true, selected: true, cursorPos: arg.payload.cursorPos };
        }
        if (removeFocusIndex >= 0) {
            newVMs[removeFocusIndex] = { ...newVMs[removeFocusIndex], focused: false, selected: false };
        }
        return {
            ...arg.prevState,
            cellVMs: newVMs,
            focusedCellId: arg.payload.cellId,
            selectedCellId: arg.payload.cellId
        };
    }

    export function unfocusCell(arg: NativeEditorReducerArg<ICodeAction>): IMainState {
        // Unfocus the currently focused cell and change its code
        const focusedCell = arg.prevState.focusedCellId || arg.payload.cellId;
        const index = arg.prevState.cellVMs.findIndex(c => c.cell.id === focusedCell);
        if (index >= 0) {
            const newVMs = [...arg.prevState.cellVMs];
            const current = arg.prevState.cellVMs[index];
            const newCell = {
                ...current,
                focused: false,
                cell: {
                    ...current.cell,
                    data: {
                        ...current.cell.data,
                        source: arg.payload.code
                    }
                }
            };

            // tslint:disable-next-line: no-any
            newVMs[index] = (newCell as any); // This is because IMessageCell doesn't fit in here

            return {
                ...arg.prevState,
                cellVMs: newVMs,
                focusedCellId: undefined
            };
        }

        return arg.prevState;
    }

    export function selectCell(arg: NativeEditorReducerArg<ICellAndCursorAction>): IMainState {
        const newVMs = [...arg.prevState.cellVMs];

        // Select one cell and unselect another.
        const addIndex = newVMs.findIndex(c => c.cell.id === arg.payload.cellId);
        const removeIndex = newVMs.findIndex(c => c.cell.id === arg.prevState.selectedCellId);
        if (addIndex >= 0) {
            newVMs[addIndex] = {
                ...newVMs[addIndex],
                focused: arg.prevState.focusedCellId !== undefined && arg.prevState.focusedCellId === arg.prevState.selectedCellId,
                selected: true,
                cursorPos: arg.payload.cursorPos
            };
        }
        if (removeIndex >= 0) {
            newVMs[removeIndex] = { ...newVMs[removeIndex], focused: false, selected: false };
        }
        return {
            ...arg.prevState,
            cellVMs: newVMs,
            focusedCellId: arg.prevState.focusedCellId !== undefined ? arg.payload.cellId : undefined,
            selectedCellId: arg.payload.cellId
        };
    }

    export function toggleLineNumbers(arg: NativeEditorReducerArg<ICellAction>): IMainState {
        const index = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.payload.cellId);
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
        const index = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.payload.cellId);
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

    export function selectNextCell(arg: NativeEditorReducerArg<ICellAction>): IMainState {
        const index = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.payload.cellId);
        if (index < arg.prevState.cellVMs.length - 1) {
            return selectCell({ ...arg, payload: { cellId: arg.prevState.cellVMs[index + 1].cell.id, cursorPos: CursorPos.Current } });
        }

        return arg.prevState;
    }

    export function notebookDirty(arg: NativeEditorReducerArg): IMainState {
        return {
            ...arg.prevState,
            dirty: true
        };
    }

    export function notebookClean(arg: NativeEditorReducerArg): IMainState {
        return {
            ...arg.prevState,
            dirty: false
        };
    }

    export function startProgress(arg: NativeEditorReducerArg): IMainState {
        return {
            ...arg.prevState,
            busy: true
        };
    }

    export function stopProgress(arg: NativeEditorReducerArg): IMainState {
        return {
            ...arg.prevState,
            busy: false
        };
    }

    export function updateSettings(arg: NativeEditorReducerArg<string>): IMainState {
        // String arg should be the IDataScienceExtraSettings
        const newSettingsJSON = JSON.parse(arg.payload);
        const newSettings = <IDataScienceExtraSettings>newSettingsJSON;
        const newEditorOptions = computeEditorOptions(newSettings);
        const newFontFamily = newSettings.extraSettings ? newSettings.extraSettings.fontFamily : arg.prevState.font.family;
        const newFontSize = newSettings.extraSettings ? newSettings.extraSettings.fontSize : arg.prevState.font.size;

        // Ask for new theme data if necessary
        if (newSettings && newSettings.extraSettings && newSettings.extraSettings.theme !== arg.prevState.vscodeThemeName) {
            const knownDark = Helpers.computeKnownDark(newSettings);
            // User changed the current theme. Rerender
            arg.postMessage(CssMessages.GetCssRequest, { isDark: knownDark });
            arg.postMessage(CssMessages.GetMonacoThemeRequest, { isDark: knownDark });
        }

        return {
            ...arg.prevState,
            settings: newSettings,
            editorOptions: newEditorOptions,
            font: {
                size: newFontSize,
                family: newFontFamily
            }
        };
    }

    export function activate(arg: NativeEditorReducerArg): IMainState {
        return {
            ...arg.prevState,
            activateCount: arg.prevState.activateCount + 1
        };
    }

    export function handleCss(arg: NativeEditorReducerArg<IGetCssResponse>): IMainState {
        // Recompute our known dark value from the class name in the body
        // VS code should update this dynamically when the theme changes
        const computedKnownDark = Helpers.computeKnownDark(arg.prevState.settings);

        // We also get this in our response, but computing is more reliable
        // than searching for it.
        const newBaseTheme = (arg.prevState.knownDark !== computedKnownDark && !arg.prevState.testMode) ?
            computedKnownDark ? 'vscode-dark' : 'vscode-light' : arg.prevState.baseTheme;

        let fontSize: number = 14;
        let fontFamily: string = 'Consolas, \'Courier New\', monospace';
        const sizeSetting = '--code-font-size: ';
        const familySetting = '--code-font-family: ';
        const fontSizeIndex = arg.payload.css.indexOf(sizeSetting);
        const fontFamilyIndex = arg.payload.css.indexOf(familySetting);

        if (fontSizeIndex > -1) {
            const fontSizeEndIndex = arg.payload.css.indexOf('px;', fontSizeIndex + sizeSetting.length);
            fontSize = parseInt(arg.payload.css.substring(fontSizeIndex + sizeSetting.length, fontSizeEndIndex), 10);
        }

        if (fontFamilyIndex > -1) {
            const fontFamilyEndIndex = arg.payload.css.indexOf(';', fontFamilyIndex + familySetting.length);
            fontFamily = arg.payload.css.substring(fontFamilyIndex + familySetting.length, fontFamilyEndIndex);
        }

        return {
            ...arg.prevState,
            rootCss: arg.payload.css,
            font: {
                size: fontSize,
                family: fontFamily
            },
            vscodeThemeName: arg.payload.theme,
            knownDark: computedKnownDark,
            baseTheme: newBaseTheme
        };
    }

    export function monacoReady(arg: NativeEditorReducerArg): IMainState {
        return {
            ...arg.prevState,
            monacoReady: true
        };
    }

    export function monacoThemeChange(arg: NativeEditorReducerArg<IGetMonacoThemeResponse>): IMainState {
        return {
            ...arg.prevState,
            monacoTheme: Identifiers.GeneratedThemeName
        };
    }
}
