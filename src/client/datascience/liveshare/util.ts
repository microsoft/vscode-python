
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

export function escapeCommandName(command: string) : string {
    // Replace . with $ instead.
    return command.replace(/\./g, '$');
}

export function unescapeCommandName(command: string) : string {
    // Turn $ back into .
    return command.replace(/\$/g, '.');
}
