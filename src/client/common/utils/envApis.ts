// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { env } from 'vscode';

export function isWsl(): boolean {
    return env.remoteName === 'wsl';
}
