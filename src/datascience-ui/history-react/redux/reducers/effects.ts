// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { IMainState } from '../../../interactive-common/mainState';
import { InteractiveReducerArg } from '../mapping';
import { Creation } from './creation';
import { computeEditorOptions } from '../../../react-common/settingsReactSide';
import { IDataScienceExtraSettings } from '../../../../client/datascience/types';
import { Helpers } from '../../../interactive-common/redux/reducers/helpers';
import { CssMessages } from '../../../../client/datascience/messages';
import { ICellAction } from '../actions';
import { createPostableAction } from '../../../interactive-common/redux/postOffice';

export namespace Effects {

    export function expandAll(arg: InteractiveReducerArg): IMainState {
        if (arg.prevState.settings.showCellInputCode) {
            const newVMs = arg.prevState.cellVMs.map(c => Creation.alterCellVM({ ...c }, arg.prevState.settings, true, true));
            return {
                ...arg.prevState,
                cellVMs: newVMs
            };
        }
        return arg.prevState;
    }

    export function collapseAll(arg: InteractiveReducerArg): IMainState {
        if (arg.prevState.settings.showCellInputCode) {
            const newVMs = arg.prevState.cellVMs.map(c => Creation.alterCellVM({ ...c }, arg.prevState.settings, true, false));
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
        const newFontFamily = newSettings.extraSettings ? newSettings.extraSettings.fontFamily : arg.prevState.font.family;
        const newFontSize = newSettings.extraSettings ? newSettings.extraSettings.fontSize : arg.prevState.font.size;

        // Ask for new theme data if necessary
        if (newSettings && newSettings.extraSettings && newSettings.extraSettings.theme !== arg.prevState.vscodeThemeName) {
            const knownDark = Helpers.computeKnownDark(newSettings);
            // User changed the current theme. Rerender
            arg.queueAction(createPostableAction(CssMessages.GetCssRequest, { isDark: knownDark }));
            arg.queueAction(createPostableAction(CssMessages.GetMonacoThemeRequest, { isDark: knownDark }));
        }

        // Update our input cell state if the user changed this setting
        let newVMs = arg.prevState.cellVMs;
        if (newSettings.showCellInputCode !== arg.prevState.settings.showCellInputCode) {
            newVMs = arg.prevState.cellVMs.map(c => Creation.alterCellVM(
                c, newSettings, newSettings.showCellInputCode, !newSettings.collapseCellInputCodeByDefault));
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

    export function scrollToCell(arg: InteractiveReducerArg<ICellAction>): IMainState {
        return {
            ...arg.prevState,
            scrolledCellId: arg.payload.cellId
        };
    }
}
