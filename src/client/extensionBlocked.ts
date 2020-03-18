// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IExtensionContext } from './common/types';

export async function isBlocked(_context: IExtensionContext): Promise<boolean | undefined> {
    return false;
}

export async function promptBlock(): Promise<boolean> {
    return false;
}

export async function promptUnblock(): Promise<boolean> {
    return true;
}
