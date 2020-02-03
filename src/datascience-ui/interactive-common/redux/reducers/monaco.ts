// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import { Reducer } from 'redux';

import { Identifiers } from '../../../../client/datascience/constants';
import {
    InteractiveWindowMessages,
    IProvideCompletionItemsResponse,
    IProvideHoverResponse,
    IProvideSignatureHelpResponse,
    IResolveCompletionItemResponse
} from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
import { BaseReduxActionPayload } from '../../../../client/datascience/interactive-common/types';
import { CssMessages } from '../../../../client/datascience/messages';
import { IGetMonacoThemeResponse } from '../../../../client/datascience/monacoMessages';
import { logMessage } from '../../../react-common/logger';
import { PostOffice } from '../../../react-common/postOffice';
import { combineReducers, QueuableAction, ReducerArg, ReducerFunc } from '../../../react-common/reduxUtils';
import { IntellisenseProvider } from '../../intellisenseProvider';
import { initializeTokenizer, registerMonacoLanguage } from '../../tokenizer';
import { createIncomingAction } from '../helpers';
import { CommonActionType, ICodeCreatedAction, IEditCellAction } from './types';

export interface IMonacoState {
    onigasmData: ArrayBuffer | undefined;
    tmLanguageData: string | undefined;
    testMode: boolean;
    intellisenseProvider: IntellisenseProvider | undefined;
    postOffice: PostOffice;
}

type MonacoReducerFunc<T = never | undefined> = ReducerFunc<IMonacoState, CommonActionType | InteractiveWindowMessages, BaseReduxActionPayload<T>>;

type MonacoReducerArg<T = never | undefined> = ReducerArg<IMonacoState, CommonActionType | InteractiveWindowMessages, BaseReduxActionPayload<T>>;

function handleStarted<T>(arg: MonacoReducerArg<T>): IMonacoState {
    // If in test mode, register the monaco provider
    if (arg.prevState.testMode) {
        registerMonacoLanguage();
    }

    // When the window is first starting up, create our intellisense provider
    //
    // Note: We're not using arg.queueAction to send messages because of two reasons
    // 1) The queueAction would be used outside of a reducer. This is a no no because its state would be off
    // 2) A reducer can cause an IntellisenseProvider update, this would mean we'd be dispatching inside of a reducer
    //   and that's not allowed in redux.
    // So instead, just post messages directly.
    if (!arg.prevState.intellisenseProvider && arg.prevState.postOffice) {
        return {
            ...arg.prevState,
            intellisenseProvider: new IntellisenseProvider(arg.prevState.postOffice.sendMessage.bind(arg.prevState.postOffice))
        };
    }

    return arg.prevState;
}

function finishTokenizer<T>(buffer: ArrayBuffer, tmJson: string, arg: MonacoReducerArg<T>) {
    initializeTokenizer(buffer, tmJson, e => {
        if (e) {
            logMessage(`ERROR from onigasm: ${e}`);
        }
        arg.queueAction(createIncomingAction(InteractiveWindowMessages.MonacoReady));
    }).ignoreErrors();
}

function handleLoadOnigasmResponse(arg: MonacoReducerArg<Buffer>): IMonacoState {
    // Have to convert the buffer into an ArrayBuffer for the tokenizer to load it.
    // tslint:disable-next-line: no-any
    const typedArray = new Uint8Array((arg.payload.data as any).data);

    if (arg.prevState.tmLanguageData && !arg.prevState.onigasmData && typedArray.length > 0) {
        // Monaco is ready. Initialize the tokenizer
        finishTokenizer(typedArray.buffer, arg.prevState.tmLanguageData, arg);
    }

    // Make sure we start the intellisense provider
    return {
        ...arg.prevState,
        onigasmData: typedArray.buffer
    };
}

function handleLoadTmLanguageResponse(arg: MonacoReducerArg<string>): IMonacoState {
    if (arg.prevState.onigasmData && !arg.prevState.tmLanguageData) {
        // Monaco is ready. Initialize the tokenizer
        finishTokenizer(arg.prevState.onigasmData, arg.payload.data, arg);
    }

    return {
        ...arg.prevState,
        tmLanguageData: arg.payload.data
    };
}

function handleThemeResponse(arg: MonacoReducerArg<IGetMonacoThemeResponse>): IMonacoState {
    // Tell monaco we have a new theme. THis is like a state update for monaco
    monacoEditor.editor.defineTheme(Identifiers.GeneratedThemeName, arg.payload.data.theme);
    return arg.prevState;
}

function handleCompletionItemsResponse(arg: MonacoReducerArg<IProvideCompletionItemsResponse>): IMonacoState {
    const ensuredProvider = handleStarted(arg);
    ensuredProvider.intellisenseProvider!.handleCompletionResponse(arg.payload.data);
    return ensuredProvider;
}

function handleResolveCompletionItemResponse(arg: MonacoReducerArg<IResolveCompletionItemResponse>): IMonacoState {
    const ensuredProvider = handleStarted(arg);
    ensuredProvider.intellisenseProvider!.handleResolveCompletionItemResponse(arg.payload.data);
    return ensuredProvider;
}

function handleSignatureHelpResponse(arg: MonacoReducerArg<IProvideSignatureHelpResponse>): IMonacoState {
    const ensuredProvider = handleStarted(arg);
    ensuredProvider.intellisenseProvider!.handleSignatureHelpResponse(arg.payload.data);
    return ensuredProvider;
}

function handleHoverResponse(arg: MonacoReducerArg<IProvideHoverResponse>): IMonacoState {
    const ensuredProvider = handleStarted(arg);
    ensuredProvider.intellisenseProvider!.handleHoverResponse(arg.payload.data);
    return ensuredProvider;
}

function handleCodeCreated(arg: MonacoReducerArg<ICodeCreatedAction>): IMonacoState {
    const ensuredProvider = handleStarted(arg);
    if (arg.payload.data.cellId) {
        ensuredProvider.intellisenseProvider!.mapCellIdToModelId(arg.payload.data.cellId, arg.payload.data.modelId);
    }
    return ensuredProvider;
}

function handleEditCell(arg: MonacoReducerArg<IEditCellAction>): IMonacoState {
    const ensuredProvider = handleStarted(arg);
    if (arg.payload.data.cellId) {
        ensuredProvider.intellisenseProvider!.mapCellIdToModelId(arg.payload.data.cellId, arg.payload.data.modelId);
    }
    return ensuredProvider;
}

function handleUnmount(arg: MonacoReducerArg): IMonacoState {
    if (arg.prevState.intellisenseProvider) {
        arg.prevState.intellisenseProvider.dispose();
    }

    return {
        ...arg.prevState,
        onigasmData: undefined,
        tmLanguageData: undefined
    };
}

// type MonacoReducerFunctions<T> = {
//     [P in keyof T]: T[P] extends never | undefined ? MonacoReducerFunc : MonacoReducerFunc<T[P]>;
// };

// type IMonacoActionMapping = MonacoReducerFunctions<IInteractiveWindowMapping> & MonacoReducerFunctions<CommonActionTypeMapping>;
// Create a mapping between message and reducer type
class IMonacoActionMapping {
    public [InteractiveWindowMessages.Started]: MonacoReducerFunc;
    public [InteractiveWindowMessages.LoadOnigasmAssemblyResponse]: MonacoReducerFunc<Buffer>;
    public [InteractiveWindowMessages.LoadTmLanguageResponse]: MonacoReducerFunc<string>;
    public [CssMessages.GetMonacoThemeResponse]: MonacoReducerFunc<IGetMonacoThemeResponse>;
    public [InteractiveWindowMessages.ProvideCompletionItemsResponse]: MonacoReducerFunc<IProvideCompletionItemsResponse>;
    public [InteractiveWindowMessages.ProvideSignatureHelpResponse]: MonacoReducerFunc<IProvideSignatureHelpResponse>;
    public [InteractiveWindowMessages.ProvideHoverResponse]: MonacoReducerFunc<IProvideHoverResponse>;
    public [InteractiveWindowMessages.ResolveCompletionItemResponse]: MonacoReducerFunc<IResolveCompletionItemResponse>;
    public [CommonActionType.CODE_CREATED]: MonacoReducerFunc<ICodeCreatedAction>;
    public [CommonActionType.EDIT_CELL]: MonacoReducerFunc<IEditCellAction>;
    public [CommonActionType.UNMOUNT]: MonacoReducerFunc;
}

// Create the map between message type and the actual function to call to update state
const reducerMap: IMonacoActionMapping = {
    [InteractiveWindowMessages.Started]: handleStarted,
    [InteractiveWindowMessages.LoadOnigasmAssemblyResponse]: handleLoadOnigasmResponse,
    [InteractiveWindowMessages.LoadTmLanguageResponse]: handleLoadTmLanguageResponse,
    [CssMessages.GetMonacoThemeResponse]: handleThemeResponse,
    [InteractiveWindowMessages.ProvideCompletionItemsResponse]: handleCompletionItemsResponse,
    [InteractiveWindowMessages.ProvideSignatureHelpResponse]: handleSignatureHelpResponse,
    [InteractiveWindowMessages.ProvideHoverResponse]: handleHoverResponse,
    [InteractiveWindowMessages.ResolveCompletionItemResponse]: handleResolveCompletionItemResponse,
    [CommonActionType.CODE_CREATED]: handleCodeCreated,
    [CommonActionType.EDIT_CELL]: handleEditCell,
    [CommonActionType.UNMOUNT]: handleUnmount
};

export function generateMonacoReducer(testMode: boolean, postOffice: PostOffice): Reducer<IMonacoState, QueuableAction<IMonacoActionMapping>> {
    // First create our default state.
    const defaultState: IMonacoState = {
        onigasmData: undefined,
        tmLanguageData: undefined,
        testMode,
        intellisenseProvider: undefined,
        postOffice
    };

    // Then combine that with our map of state change message to reducer
    return combineReducers<IMonacoState, IMonacoActionMapping>(defaultState, reducerMap);
}
