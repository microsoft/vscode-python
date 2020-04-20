// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { nbformat } from '@jupyterlab/coreutils';
import type { KernelMessage } from '@jupyterlab/services';
import { Identifiers } from '../../../../client/datascience/constants';
import { InteractiveWindowMessages } from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
import { IGetCssResponse } from '../../../../client/datascience/messages';
import { IGetMonacoThemeResponse } from '../../../../client/datascience/monacoMessages';
import { CellState, ICell } from '../../../../client/datascience/types';
import { ICellViewModel, IMainState } from '../../../interactive-common/mainState';
import { Helpers } from '../../../interactive-common/redux/reducers/helpers';
import { getLocString, storeLocStrings } from '../../../react-common/locReactSide';
import { postActionToExtension } from '../helpers';
import { Transfer } from './transfer';
import {
    CommonActionType,
    CommonReducerArg,
    ILoadIPyWidgetClassFailureAction,
    IOpenSettingsAction,
    LoadIPyWidgetClassLoadAction,
    NotifyIPyWidgeWidgetVersionNotSupportedAction
} from './types';

export namespace CommonEffects {
    export function notebookDirty(arg: CommonReducerArg): IMainState {
        return {
            ...arg.prevState,
            dirty: true
        };
    }

    export function notebookClean(arg: CommonReducerArg): IMainState {
        return {
            ...arg.prevState,
            dirty: false
        };
    }

    export function startProgress(arg: CommonReducerArg): IMainState {
        return {
            ...arg.prevState,
            busy: true
        };
    }

    export function stopProgress(arg: CommonReducerArg): IMainState {
        return {
            ...arg.prevState,
            busy: false
        };
    }

    export function activate(arg: CommonReducerArg): IMainState {
        return focusPending(arg.prevState);
    }

    export function focusInput(arg: CommonReducerArg): IMainState {
        return focusPending(arg.prevState);
    }

    export function handleLocInit(arg: CommonReducerArg<CommonActionType, string>): IMainState {
        // Read in the loc strings
        const locJSON = JSON.parse(arg.payload.data);
        storeLocStrings(locJSON);
        return arg.prevState;
    }

    export function handleCss(arg: CommonReducerArg<CommonActionType, IGetCssResponse>): IMainState {
        // Recompute our known dark value from the class name in the body
        // VS code should update this dynamically when the theme changes
        const computedKnownDark = Helpers.computeKnownDark(arg.prevState.settings);

        // We also get this in our response, but computing is more reliable
        // than searching for it.
        const newBaseTheme =
            arg.prevState.knownDark !== computedKnownDark && !arg.prevState.testMode
                ? computedKnownDark
                    ? 'vscode-dark'
                    : 'vscode-light'
                : arg.prevState.baseTheme;

        let fontSize: number = 14;
        let fontFamily: string = "Consolas, 'Courier New', monospace";
        const sizeSetting = '--code-font-size: ';
        const familySetting = '--code-font-family: ';
        const fontSizeIndex = arg.payload.data.css.indexOf(sizeSetting);
        const fontFamilyIndex = arg.payload.data.css.indexOf(familySetting);

        if (fontSizeIndex > -1) {
            const fontSizeEndIndex = arg.payload.data.css.indexOf('px;', fontSizeIndex + sizeSetting.length);
            fontSize = parseInt(
                arg.payload.data.css.substring(fontSizeIndex + sizeSetting.length, fontSizeEndIndex),
                10
            );
        }

        if (fontFamilyIndex > -1) {
            const fontFamilyEndIndex = arg.payload.data.css.indexOf(';', fontFamilyIndex + familySetting.length);
            fontFamily = arg.payload.data.css.substring(fontFamilyIndex + familySetting.length, fontFamilyEndIndex);
        }

        return {
            ...arg.prevState,
            rootCss: arg.payload.data.css,
            font: {
                size: fontSize,
                family: fontFamily
            },
            vscodeThemeName: arg.payload.data.theme,
            knownDark: computedKnownDark,
            baseTheme: newBaseTheme
        };
    }

    export function monacoReady<T>(arg: CommonReducerArg<T>): IMainState {
        return {
            ...arg.prevState,
            monacoReady: true
        };
    }

    export function monacoThemeChange<T>(arg: CommonReducerArg<T, IGetMonacoThemeResponse>): IMainState {
        return {
            ...arg.prevState,
            monacoTheme: Identifiers.GeneratedThemeName
        };
    }

    function focusPending(prevState: IMainState): IMainState {
        return {
            ...prevState,
            // This is only applicable for interactive window & not native editor.
            focusPending: prevState.focusPending + 1
        };
    }

    export function openSettings(arg: CommonReducerArg<CommonActionType, IOpenSettingsAction>): IMainState {
        postActionToExtension(arg, InteractiveWindowMessages.OpenSettings, arg.payload.data.setting);
        return arg.prevState;
    }

    export function handleUpdateDisplayData(
        arg: CommonReducerArg<CommonActionType, KernelMessage.IUpdateDisplayDataMsg>
    ): IMainState {
        const newCells: ICell[] = [];
        const oldCells: ICell[] = [];

        // Find any cells that have this display_id
        const newVMs = arg.prevState.cellVMs.map((c: ICellViewModel) => {
            if (c.cell.data.cell_type === 'code') {
                let isMatch = false;
                const data: nbformat.ICodeCell = c.cell.data as nbformat.ICodeCell;
                const changedOutputs = data.outputs.map((o) => {
                    if (
                        (o.output_type === 'display_data' || o.output_type === 'execute_result') &&
                        o.transient &&
                        // tslint:disable-next-line: no-any
                        (o.transient as any).display_id === arg.payload.data.content.transient.display_id
                    ) {
                        // Remember this as a match
                        isMatch = true;

                        // If the output has this display_id, update the output
                        return {
                            ...o,
                            data: arg.payload.data.content.data,
                            metadata: arg.payload.data.content.metadata
                        };
                    } else {
                        return o;
                    }
                });

                // Save in our new cell list so we can tell the extension
                // about our update
                const newCell = isMatch
                    ? Helpers.asCell({
                          ...c.cell,
                          data: {
                              ...c.cell.data,
                              outputs: changedOutputs
                          }
                      })
                    : c.cell;
                if (isMatch) {
                    newCells.push(newCell);
                } else {
                    oldCells.push(newCell);
                }
                return Helpers.asCellViewModel({
                    ...c,
                    cell: newCell
                });
            } else {
                oldCells.push(c.cell);
                return c;
            }
        });

        // If we found the display id, then an update happened. Tell the model about it
        if (newCells.length) {
            Transfer.postModelCellUpdate(arg, newCells, oldCells);
        }

        return {
            ...arg.prevState,
            cellVMs: newVMs
        };
    }
    export function handleLoadIPyWidgetClassSuccess(
        arg: CommonReducerArg<CommonActionType, LoadIPyWidgetClassLoadAction>
    ): IMainState {
        // Make sure to tell the extension so it can log telemetry.
        postActionToExtension(arg, InteractiveWindowMessages.IPyWidgetLoadSuccess, arg.payload.data);
        return arg.prevState;
    }
    export function handleLoadIPyWidgetClassFailure(
        arg: CommonReducerArg<CommonActionType, ILoadIPyWidgetClassFailureAction>
    ): IMainState {
        // Find the first currently executing cell and add an error to its output
        let index = arg.prevState.cellVMs.findIndex((c) => c.cell.state === CellState.executing);

        // If there isn't one, then find the latest that matches the current execution count.
        if (index < 0) {
            index = arg.prevState.cellVMs.findIndex(
                (c) => c.cell.data.execution_count === arg.prevState.currentExecutionCount
            );
        }
        if (index >= 0 && arg.prevState.cellVMs[index].cell.data.cell_type === 'code') {
            const newVMs = [...arg.prevState.cellVMs];
            const current = arg.prevState.cellVMs[index];

            let errorMessage = arg.payload.data.error.toString();
            if (!arg.payload.data.isOnline) {
                errorMessage = getLocString(
                    'DataScience.loadClassFailedWithNoInternet',
                    'Error loading {0}:{1}. Internet connection required for loading 3rd party widgets.'
                ).format(arg.payload.data.moduleName, arg.payload.data.moduleVersion);
            } else if (!arg.payload.data.cdnsUsed) {
                errorMessage = getLocString(
                    'DataScience.enableCDNForWidgetsSetting',
                    "Widgets require us to download supporting files from a 3rd party website. Click <a href='https://command:python.datascience.enableLoadingWidgetScriptsFromThirdPartySource'>here</a> to enable this or click <a href='https://aka.ms/PVSCIPyWidgets'>here</a> for more information. (Error loading {0}:{1})."
                ).format(arg.payload.data.moduleName, arg.payload.data.moduleVersion);
            }
            newVMs[index] = Helpers.asCellViewModel({
                ...current,
                uiSideError: errorMessage
            });

            // Make sure to tell the extension so it can log telemetry.
            postActionToExtension(arg, InteractiveWindowMessages.IPyWidgetLoadFailure, arg.payload.data);

            return {
                ...arg.prevState,
                cellVMs: newVMs
            };
        } else {
            return arg.prevState;
        }
    }
    export function notifyAboutUnsupportedWidgetVersions(
        arg: CommonReducerArg<CommonActionType, NotifyIPyWidgeWidgetVersionNotSupportedAction>
    ): IMainState {
        // Find the first currently executing cell and add an error to its output
        let index = arg.prevState.cellVMs.findIndex((c) => c.cell.state === CellState.executing);

        // If there isn't one, then find the latest that matches the current execution count.
        if (index < 0) {
            index = arg.prevState.cellVMs.findIndex(
                (c) => c.cell.data.execution_count === arg.prevState.currentExecutionCount
            );
        }
        if (index >= 0 && arg.prevState.cellVMs[index].cell.data.cell_type === 'code') {
            const newVMs = [...arg.prevState.cellVMs];
            const current = arg.prevState.cellVMs[index];

            const errorMessage = getLocString(
                'DataScience.qgridWidgetScriptVersionCompatibilityWarning',
                "Unable to load a compatible version of the widget 'qgrid'. Consider downgrading to version 1.1.1."
            );
            newVMs[index] = Helpers.asCellViewModel({
                ...current,
                uiSideError: errorMessage
            });

            // Make sure to tell the extension so it can log telemetry.
            postActionToExtension(arg, InteractiveWindowMessages.IPyWidgetWidgetVersionNotSupported, arg.payload.data);

            return {
                ...arg.prevState,
                cellVMs: newVMs
            };
        } else {
            return arg.prevState;
        }
    }
    export function handleIPyWidgetRenderFailure(arg: CommonReducerArg<CommonActionType, Error>): IMainState {
        // Make sure to tell the extension so it can log telemetry.
        postActionToExtension(arg, InteractiveWindowMessages.IPyWidgetRenderFailure, arg.payload.data);
        return arg.prevState;
    }
}
