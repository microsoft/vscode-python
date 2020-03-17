// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IExtensionContext } from './common/types';

export const ERR_BLOCKED = new Error('extension activation blocked');

export async function isBlocked(_context: IExtensionContext): Promise<boolean | undefined> {
    return false;
}
