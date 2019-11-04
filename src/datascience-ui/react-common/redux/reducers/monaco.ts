// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { InteractiveWindowMessages, IInteractiveWindowMapping } from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
import { QueuableAction, PostMessageFunc, combineReducers, ReducerFunc, ReducerArg } from '../../reduxUtils';
import { PostOffice } from '../../postOffice';
import { Reducer } from 'redux';
import { CssMessages } from '../../../../client/datascience/messages';
import { IGetMonacoThemeResponse } from '../../../../client/datascience/monacoMessages';
import { initializeTokenizer } from '../../../interactive-common/tokenizer';

export interface IMonacoState {
    onigasmData: Buffer | undefined;
    tmLanguageData: string | undefined;
    testMode: boolean;
}

type MonacoReducerFunc<T> = ReducerFunc<IMonacoState, InteractiveWindowMessages, T>;

type MonacoReducerArg<T = never | undefined> = ReducerArg<IMonacoState, InteractiveWindowMessages, T>;

namespace Reducers {

    function handleLoadOnigasmResponse(arg: MonacoReducerArg<Buffer>): IMonacoState {
        if (arg.prevState.tmLanguageData) {
            // Monaco is ready. Initialize the tokenizer
            initializeTokenizer(arg.payload, arg.prevState.tmLanguageData, () => arg.postMessage(InteractiveWindowMessages.MonacoReady)).ignoreErrors();
        }

        return {
            ...arg.prevState,
            onigasmData: arg.payload
        };
    }

    function handleLoadTmLanguageResponse(arg: MonacoReducerArg<string>): IMonacoState {
        if (arg.prevState.tmLanguageData) {
            // Monaco is ready. Initialize the tokenizer
            initializeTokenizer(arg.payload, arg.prevState.tmLanguageData, () => arg.postMessage(InteractiveWindowMessages.MonacoReady)).ignoreErrors();
        }

        return {
            ...arg.prevState,
            onigasmData: arg.payload
        };
    }
}


class IMonacoActionMapping {
    public [InteractiveWindowMessages.LoadOnigasmAssemblyResponse]: MonacoReducerFunc<Buffer>;
    public [InteractiveWindowMessages.LoadTmLanguageResponse]: MonacoReducerFunc<string>;
    public [CssMessages.GetMonacoThemeResponse]: MonacoReducerFunc<IGetMonacoThemeResponse>;
}

const reducerMap: IMonacoActionMapping = {
    [InteractiveWindowMessages.LoadOnigasmAssemblyResponse]: Reducers.handleLoadOnigasmResponse,
    [InteractiveWindowMessages.LoadTmLanguageResponse]: Reducers.handleLoadTmLanguageResponse,
    [CssMessages.GetMonacoThemeResponse]: Reducers.handleThemeResponse
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
