// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Info as PlatformInfo, isWindows } from '../../../utils/platform';
import {
    NON_WINDOWS_PATH_VARIABLE_NAME,
    WINDOWS_PATH_VARIABLE_NAME
} from './constants';

export function getPathVariableName(info: PlatformInfo) {
    return isWindows(info) ? WINDOWS_PATH_VARIABLE_NAME : NON_WINDOWS_PATH_VARIABLE_NAME;
}

export function getVirtualEnvBinName(info: PlatformInfo) {
    return isWindows(info) ? 'scripts' : 'bin';
}
