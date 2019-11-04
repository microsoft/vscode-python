// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Reducer, Action } from 'redux';

import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import {
    IInteractiveWindowMapping,
    InteractiveWindowMessages
} from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
import { CssMessages } from '../../../../client/datascience/messages';
import { IGetMonacoThemeResponse } from '../../../../client/datascience/monacoMessages';
import { initializeTokenizer } from '../../../interactive-common/tokenizer';
import { PostOffice } from '../../postOffice';
import { combineReducers, PostMessageFunc, QueuableAction, ReducerArg, ReducerFunc } from '../../reduxUtils';
import { Identifiers } from '../../../../client/datascience/constants';

export interface IMonacoState {
    onigasmData: Buffer | undefined;
    tmLanguageData: string | undefined;
    testMode: boolean;
}

type MonacoReducerFunc<T> = ReducerFunc<IMonacoState, InteractiveWindowMessages, T>;

type MonacoReducerArg<T = never | undefined> = ReducerArg<IMonacoState, InteractiveWindowMessages, T>;

function handleLoadOnigasmResponse(arg: MonacoReducerArg<Buffer>): IMonacoState {
    if (arg.prevState.tmLanguageData) {
        // Monaco is ready. Initialize the tokenizer
        initializeTokenizer(arg.payload, arg.prevState.tmLanguageData, () => arg.queueAnother({ type: InteractiveWindowMessages.MonacoReady })).ignoreErrors();
    }

    return {
        ...arg.prevState,
        onigasmData: arg.payload
    };
}

function handleLoadTmLanguageResponse(arg: MonacoReducerArg<string>): IMonacoState {
    if (arg.prevState.onigasmData) {
        // Monaco is ready. Initialize the tokenizer
        initializeTokenizer(arg.prevState.onigasmData, arg.payload, () => arg.queueAnother({ type: InteractiveWindowMessages.MonacoReady })).ignoreErrors();
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
    public [InteractiveWindowMessages.LoadOnigasmAssemblyResponse]: MonacoReducerFunc<Buffer>;
    public [InteractiveWindowMessages.LoadTmLanguageResponse]: MonacoReducerFunc<string>;
    public [CssMessages.GetMonacoThemeResponse]: MonacoReducerFunc<IGetMonacoThemeResponse>;
}

// Create the map between message type and the actual function to call to update state
const reducerMap: IMonacoActionMapping = {
    [InteractiveWindowMessages.LoadOnigasmAssemblyResponse]: handleLoadOnigasmResponse,
    [InteractiveWindowMessages.LoadTmLanguageResponse]: handleLoadTmLanguageResponse,
    [CssMessages.GetMonacoThemeResponse]: handleThemeResponse
};


export function generateMonacoReducer(testMode: boolean, postOffice: PostOffice):
    Reducer<IMonacoState, QueuableAction<IMonacoActionMapping>> {
    // First create our default state.
    const defaultState: IMonacoState = {
        onigasmData: undefined,
        tmLanguageData: undefined,
        testMode
    }

    // Extract out a post message function
    const postMessage: PostMessageFunc<IInteractiveWindowMapping> = (type, payload) => {
        setTimeout(() => postOffice.sendMessage<IInteractiveWindowMapping>(type, payload));
    };

    // Then combine that with our map of state change message to reducer
    return combineReducers<IMonacoState, IMonacoActionMapping>(
        defaultState,
        postMessage,
        reducerMap);
}
