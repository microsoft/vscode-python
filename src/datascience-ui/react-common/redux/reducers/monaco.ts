// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import { Reducer } from 'redux';

import { Identifiers } from '../../../../client/datascience/constants';
import { IGetMonacoThemeResponse } from '../../../../client/datascience/monacoMessages';
import { IncomingMessageActions } from '../../../interactive-common/redux/postOffice';
import { initializeTokenizer } from '../../../interactive-common/tokenizer';
import { combineReducers, QueuableAction, ReducerArg, ReducerFunc } from '../../reduxUtils';

export interface IMonacoState {
    onigasmData: Buffer | undefined;
    tmLanguageData: string | undefined;
    testMode: boolean;
}

type MonacoReducerFunc<T> = ReducerFunc<IMonacoState, IncomingMessageActions, T>;

type MonacoReducerArg<T = never | undefined> = ReducerArg<IMonacoState, IncomingMessageActions, T>;

function handleLoadOnigasmResponse(arg: MonacoReducerArg<Buffer>): IMonacoState {
    if (arg.prevState.tmLanguageData) {
        // Monaco is ready. Initialize the tokenizer
        initializeTokenizer(arg.payload, arg.prevState.tmLanguageData, () => arg.queueAction({ type: IncomingMessageActions.MONACOREADY })).ignoreErrors();
    }

    return {
        ...arg.prevState,
        onigasmData: arg.payload
    };
}

function handleLoadTmLanguageResponse(arg: MonacoReducerArg<string>): IMonacoState {
    if (arg.prevState.onigasmData) {
        // Monaco is ready. Initialize the tokenizer
        initializeTokenizer(arg.prevState.onigasmData, arg.payload, () => arg.queueAction({ type: IncomingMessageActions.MONACOREADY })).ignoreErrors();
    }

    return {
        ...arg.prevState,
        tmLanguageData: arg.payload
    };
}

function handleThemeResponse(arg: MonacoReducerArg<IGetMonacoThemeResponse>): IMonacoState {
    // Tell monaco we have a new theme. THis is like a state update for monaco
    monacoEditor.editor.defineTheme(Identifiers.GeneratedThemeName, arg.payload.theme);
    return arg.prevState;
}

// Create a mapping between message and reducer type
class IMonacoActionMapping {
    public [IncomingMessageActions.LOADONIGASMASSEMBLYRESPONSE]: MonacoReducerFunc<Buffer>;
    public [IncomingMessageActions.LOADTMLANGUAGERESPONSE]: MonacoReducerFunc<string>;
    public [IncomingMessageActions.GETMONACOTHEMERESPONSE]: MonacoReducerFunc<IGetMonacoThemeResponse>;
}

// Create the map between message type and the actual function to call to update state
const reducerMap: IMonacoActionMapping = {
    [IncomingMessageActions.LOADONIGASMASSEMBLYRESPONSE]: handleLoadOnigasmResponse,
    [IncomingMessageActions.LOADTMLANGUAGERESPONSE]: handleLoadTmLanguageResponse,
    [IncomingMessageActions.GETMONACOTHEMERESPONSE]: handleThemeResponse
};


export function generateMonacoReducer(testMode: boolean):
    Reducer<IMonacoState, QueuableAction<IMonacoActionMapping>> {
    // First create our default state.
    const defaultState: IMonacoState = {
        onigasmData: undefined,
        tmLanguageData: undefined,
        testMode
    };

    // Then combine that with our map of state change message to reducer
    return combineReducers<IMonacoState, IMonacoActionMapping>(
        defaultState,
        reducerMap);
}
