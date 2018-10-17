// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { DebugSessionCustomEvent } from 'vscode';

export const ICustomDebugSessionEventHandlers = Symbol('ICustomDebugSessionEventHandlers');
export interface ICustomDebugSessionEventHandlers {
    handleEvent(e: DebugSessionCustomEvent): Promise<void>;
}
