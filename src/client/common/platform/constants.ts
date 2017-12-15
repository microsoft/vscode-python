// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as arch from 'arch';
export const WINDOWS_PATH_VARIABLE_NAME = 'Path';
export const NON_WINDOWS_PATH_VARIABLE_NAME = 'PATH';
export const IS_WINDOWS = /^win/.test(process.platform);
export const IS_64_BIT = arch() === 'x64';
