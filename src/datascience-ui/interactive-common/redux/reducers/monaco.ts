// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import { Reducer } from 'redux';

import { PYTHON_LANGUAGE } from '../../../../client/common/constants';
import { createDeferred } from '../../../../client/common/utils/async';
import { Identifiers } from '../../../../client/datascience/constants';
import {
    ILoadTmLanguageResponse,
    InteractiveWindowMessages,
    IProvideCompletionItemsResponse,
    IProvideHoverResponse,
    IProvideSignatureHelpResponse,
    IResolveCompletionItemResponse
} from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
import { deserializeLanguageConfiguration } from '../../../../client/datascience/interactive-common/serialization';
import { BaseReduxActionPayload } from '../../../../client/datascience/interactive-common/types';
import { CssMessages } from '../../../../client/datascience/messages';
import { IGetMonacoThemeResponse } from '../../../../client/datascience/monacoMessages';
import { PostOffice } from '../../../react-common/postOffice';
import { combineReducers, QueuableAction, ReducerArg, ReducerFunc } from '../../../react-common/reduxUtils';
import { IntellisenseProvider } from '../../intellisenseProvider';
import { IServerState } from '../../mainState';
import { Tokenizer } from '../../tokenizer';
import { postActionToExtension, queueIncomingAction } from '../helpers';
import { CommonActionType, ICodeCreatedAction, IEditCellAction } from './types';

// Global state so we only load the onigasm bits once.
const onigasmPromise = createDeferred<boolean>();

export interface IMonacoState {
    testMode: boolean;
    intellisenseProvider: IntellisenseProvider | undefined;
    postOffice: PostOffice;
    language: string;
}

type MonacoReducerFunc<T = never | undefined> = ReducerFunc<
    IMonacoState,
    CommonActionType | InteractiveWindowMessages,
    BaseReduxActionPayload<T>
>;

type MonacoReducerArg<T = never | undefined> = ReducerArg<
    IMonacoState,
    CommonActionType | InteractiveWindowMessages,
    BaseReduxActionPayload<T>
>;

function handleLoaded<T>(arg: MonacoReducerArg<T>): IMonacoState {
    // Send the requests to get the onigasm and tmlanguage data if necessary
    if (!Tokenizer.hasOnigasm()) {
        postActionToExtension(arg, InteractiveWindowMessages.LoadOnigasmAssemblyRequest);
    }
    if (arg.prevState.language && !Tokenizer.hasLanguage(arg.prevState.language)) {
        postActionToExtension(arg, InteractiveWindowMessages.LoadTmLanguageRequest, arg.prevState.language);
    }
    // If have both, tell other side monaco is ready
    if (Tokenizer.hasOnigasm() && Tokenizer.hasLanguage(arg.prevState.language)) {
        onigasmPromise.resolve(true);
        queueIncomingAction(arg, InteractiveWindowMessages.MonacoReady);
    }

    return arg.prevState;
}

function handleStarted<T>(arg: MonacoReducerArg<T>): IMonacoState {
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
            intellisenseProvider: new IntellisenseProvider(
                arg.prevState.postOffice.sendMessage.bind(arg.prevState.postOffice),
                arg.prevState.language ?? PYTHON_LANGUAGE
            )
        };
    }

    return arg.prevState;
}

function handleLoadOnigasmResponse(arg: MonacoReducerArg<Buffer>): IMonacoState {
    if (!Tokenizer.hasOnigasm()) {
        // Have to convert the buffer into an ArrayBuffer for the tokenizer to load it.
        let typedArray = new Uint8Array(arg.payload.data);
        if (typedArray.length <= 0) {
            // tslint:disable-next-line: no-any
            typedArray = new Uint8Array((arg.payload.data as any).data);
        }
        Tokenizer.loadOnigasm(typedArray.buffer);
        onigasmPromise.resolve(true);
    }

    return arg.prevState;
}

function handleLoadTmLanguageResponse(arg: MonacoReducerArg<ILoadTmLanguageResponse>): IMonacoState {
    // First make sure we have the onigasm data first.
    onigasmPromise.promise
        .then(async () => {
            // Then load the language data
            if (!Tokenizer.hasLanguage(arg.payload.data.languageId)) {
                await Tokenizer.loadLanguage(
                    arg.payload.data.languageId,
                    arg.payload.data.extensions,
                    arg.payload.data.scopeName,
                    deserializeLanguageConfiguration(arg.payload.data.languageConfiguration),
                    arg.payload.data.languageJSON
                );
            }
            queueIncomingAction(arg, InteractiveWindowMessages.MonacoReady);
        })
        .ignoreErrors();

    return arg.prevState;
}

function handleKernelUpdate(arg: MonacoReducerArg<IServerState | undefined>): IMonacoState {
    const newLanguage = arg.payload.data?.language ?? PYTHON_LANGUAGE;
    if (newLanguage !== arg.prevState.language) {
        if (!Tokenizer.hasLanguage(newLanguage)) {
            postActionToExtension(arg, InteractiveWindowMessages.LoadTmLanguageRequest, newLanguage);
        }

        // Recreate the intellisense provider
        arg.prevState.intellisenseProvider?.dispose(); // NOSONAR
        return {
            ...arg.prevState,
            language: newLanguage,
            intellisenseProvider: new IntellisenseProvider(
                arg.prevState.postOffice.sendMessage.bind(arg.prevState.postOffice),
                newLanguage
            )
        };
    }

    return arg.prevState;
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

    return arg.prevState;
}

// type MonacoReducerFunctions<T> = {
//     [P in keyof T]: T[P] extends never | undefined ? MonacoReducerFunc : MonacoReducerFunc<T[P]>;
// };

// type IMonacoActionMapping = MonacoReducerFunctions<IInteractiveWindowMapping> & MonacoReducerFunctions<CommonActionTypeMapping>;
// Create a mapping between message and reducer type
class IMonacoActionMapping {
    public [InteractiveWindowMessages.Started]: MonacoReducerFunc;
    public [InteractiveWindowMessages.LoadOnigasmAssemblyResponse]: MonacoReducerFunc<Buffer>;
    public [InteractiveWindowMessages.LoadTmLanguageResponse]: MonacoReducerFunc<ILoadTmLanguageResponse>;
    public [CssMessages.GetMonacoThemeResponse]: MonacoReducerFunc<IGetMonacoThemeResponse>;
    public [InteractiveWindowMessages.ProvideCompletionItemsResponse]: MonacoReducerFunc<
        IProvideCompletionItemsResponse
    >;
    public [InteractiveWindowMessages.ProvideSignatureHelpResponse]: MonacoReducerFunc<IProvideSignatureHelpResponse>;
    public [InteractiveWindowMessages.ProvideHoverResponse]: MonacoReducerFunc<IProvideHoverResponse>;
    public [InteractiveWindowMessages.ResolveCompletionItemResponse]: MonacoReducerFunc<IResolveCompletionItemResponse>;
    public [InteractiveWindowMessages.UpdateKernel]: MonacoReducerFunc<IServerState | undefined>;

    public [CommonActionType.CODE_CREATED]: MonacoReducerFunc<ICodeCreatedAction>;
    public [CommonActionType.EDIT_CELL]: MonacoReducerFunc<IEditCellAction>;
    public [CommonActionType.UNMOUNT]: MonacoReducerFunc;
    public [CommonActionType.EDITOR_LOADED]: MonacoReducerFunc;
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
    [InteractiveWindowMessages.UpdateKernel]: handleKernelUpdate,
    [CommonActionType.CODE_CREATED]: handleCodeCreated,
    [CommonActionType.EDIT_CELL]: handleEditCell,
    [CommonActionType.UNMOUNT]: handleUnmount,
    [CommonActionType.EDITOR_LOADED]: handleLoaded
};

export function generateMonacoReducer(
    testMode: boolean,
    postOffice: PostOffice
): Reducer<IMonacoState, QueuableAction<IMonacoActionMapping>> {
    // First create our default state.
    const defaultState: IMonacoState = {
        testMode,
        intellisenseProvider: undefined,
        postOffice,
        language: PYTHON_LANGUAGE
    };

    // Then combine that with our map of state change message to reducer
    return combineReducers<IMonacoState, IMonacoActionMapping>(defaultState, reducerMap);
}
