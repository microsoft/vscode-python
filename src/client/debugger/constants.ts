// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import { EXTENSION_ROOT_DIR } from '../common/constants';

export const DEBUGGER_PATH = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'lib', 'python', 'debugpy');
export const DebuggerTypeName = 'python';
