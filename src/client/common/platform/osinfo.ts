// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as platform from '../utils/platform';
import {
    NON_WINDOWS_PATH_VARIABLE_NAME,
    WINDOWS_PATH_VARIABLE_NAME
} from './constants';

export function getPathVariableName(info: platform.Info) {
    return platform.isWindows(info) ? WINDOWS_PATH_VARIABLE_NAME : NON_WINDOWS_PATH_VARIABLE_NAME;
}

export function getVirtualEnvBinName(info: platform.Info) {
    return platform.isWindows(info) ? 'scripts' : 'bin';
}
