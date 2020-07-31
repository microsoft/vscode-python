// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { PythonInterpreter } from '../../../info';
import { isRestrictedWindowsStoreInterpreterPath } from './windowsStoreInterpreter';

export function isHiddenInterpreter(interpreter: PythonInterpreter): boolean {
    // Any set of rules to hide interpreters should go here
    return isRestrictedWindowsStoreInterpreterPath(interpreter.path);
}
