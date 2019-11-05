// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as ReduxCommon from '../../interactive-common/redux/store';
import { reducerMap } from './reducers';

// This special version uses the reducer map from the IInteractiveWindowMapping
export function createStore(skipDefault: boolean, baseTheme: string, testMode: boolean) {
    return ReduxCommon.createStore(skipDefault, baseTheme, testMode, reducerMap);
}
