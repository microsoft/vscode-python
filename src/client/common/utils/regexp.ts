// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

export function verboseRegExp(pattern: string): RegExp {
    pattern = pattern.replace(/\s+?/g, '');
    return RegExp(pattern);
}
