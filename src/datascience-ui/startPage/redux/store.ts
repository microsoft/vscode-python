// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as Redux from 'redux';
import { PostOffice } from '../../react-common/postOffice';
import { combineReducers, QueuableAction } from '../../react-common/reduxUtils';
import { IDefaultState } from '../startPage';
import { reducerMap } from './reducers';

// This special version uses the reducer map from the INativeEditorMapping
export function createStore(skipDefault: boolean, baseTheme: string, testMode: boolean, postOffice: PostOffice) {
    // Create reducer for the main react UI
    const mainReducer = generateMainReducer(skipDefault, testMode, baseTheme, postOffice, reducerMap);
    return Redux.createStore(mainReducer);
}

function generateMainReducer<M>(
    skipDefault: boolean,
    testMode: boolean,
    baseTheme: string,
    postOffice: PostOffice,
    rMap: M
): Redux.Reducer<IDefaultState, QueuableAction<M>> {
    // First create our default state.
    const defaultState = generateDefaultState(skipDefault, testMode, baseTheme, postOffice);

    // Then combine that with our map of state change message to reducer
    return combineReducers<IDefaultState, M>(defaultState, rMap);
}

function generateDefaultState(
    skipDefault: boolean,
    testMode: boolean,
    baseTheme: string,
    postOffice: PostOffice
): IDefaultState {
    if (!skipDefault) {
        return {
            baseTheme,
            postOffice
        };
    } else {
        return {
            skipDefault,
            testMode,
            baseTheme: baseTheme,
            postOffice
        };
    }
}
