// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

export function logMessage(message: string) {
    // Might want to post this back to the other side too. This was
    // put here to prevent having to disable the console log warning

    // tslint:disable-next-line: no-console
    console.log(message);
}
