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
    onigasmData: ArrayBuffer | undefined;
    tmLanguageData: string | undefined;
    testMode: boolean;
}

type MonacoReducerFunc<T> = ReducerFunc<IMonacoState, IncomingMessageActions, T>;

type MonacoReducerArg<T = never | undefined> = ReducerArg<IMonacoState, IncomingMessageActions, T>;

function finishTokenizer<T>(buffer: ArrayBuffer, tmJson: string, arg: MonacoReducerArg<T>) {
    initializeTokenizer(buffer, tmJson, (e) => {
        if (e) {
            window.console.log(`ERROR from onigasm: ${e}`);
        }
        arg.queueAction({ type: IncomingMessageActions.MONACOREADY });
    }).ignoreErrors();
}

function handleLoadOnigasmResponse(arg: MonacoReducerArg<Buffer>): IMonacoState {
    // Have to convert the buffer into an ArrayBuffer for the tokenizer to load it.
    // tslint:disable-next-line: no-any
    const typedArray = new Uint8Array((arg.payload as any).data);

    if (arg.prevState.tmLanguageData && !arg.prevState.onigasmData) {
        // Monaco is ready. Initialize the tokenizer
        finishTokenizer(typedArray.buffer, arg.prevState.tmLanguageData, arg);
    }

    return {
        ...arg.prevState,
        onigasmData: typedArray.buffer
    };
}

function handleLoadTmLanguageResponse(arg: MonacoReducerArg<string>): IMonacoState {
    if (arg.prevState.onigasmData && !arg.prevState.tmLanguageData) {
        // Monaco is ready. Initialize the tokenizer
        finishTokenizer(arg.prevState.onigasmData, arg.payload, arg);
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
