// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Identifiers } from '../../../../client/datascience/constants';
import { IGetCssResponse } from '../../../../client/datascience/messages';
import { IGetMonacoThemeResponse } from '../../../../client/datascience/monacoMessages';
import { IMainState } from '../../../interactive-common/mainState';
import { Helpers } from '../../../interactive-common/redux/reducers/helpers';
import { storeLocStrings } from '../../../react-common/locReactSide';
import { CommonActionType, CommonReducerArg } from './types';

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
        return {
            ...arg.prevState,
            activateCount: arg.prevState.activateCount + 1
        };
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
            arg.prevState.knownDark !== computedKnownDark && !arg.prevState.testMode ? (computedKnownDark ? 'vscode-dark' : 'vscode-light') : arg.prevState.baseTheme;

        let fontSize: number = 14;
        let fontFamily: string = "Consolas, 'Courier New', monospace";
        const sizeSetting = '--code-font-size: ';
        const familySetting = '--code-font-family: ';
        const fontSizeIndex = arg.payload.data.css.indexOf(sizeSetting);
        const fontFamilyIndex = arg.payload.data.css.indexOf(familySetting);

        if (fontSizeIndex > -1) {
            const fontSizeEndIndex = arg.payload.data.css.indexOf('px;', fontSizeIndex + sizeSetting.length);
            fontSize = parseInt(arg.payload.data.css.substring(fontSizeIndex + sizeSetting.length, fontSizeEndIndex), 10);
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
}
