// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

// tslint:disable-next-line:no-any
type Arguments = any[];

// Convert the given array of values (func call arguments) into a string
// suitable to be used in a log message.
export function argsToLogString(args: Arguments): string {
    try {
        return (args || [])
            .map((item, index) => {
                if (item === undefined) {
                    return `Arg ${index + 1}: undefined`;
                }
                if (item === null) {
                    return `Arg ${index + 1}: null`;
                }
                try {
                    if (item && item.fsPath) {
                        return `Arg ${index + 1}: <Uri:${item.fsPath}>`;
                    }
                    return `Arg ${index + 1}: ${JSON.stringify(item)}`;
                } catch {
                    return `Arg ${index + 1}: <argument cannot be serialized for logging>`;
                }
            })
            .join(', ');
    } catch {
        return '';
    }
}

// Convert the given return value into a string
// suitable to be used in a log message.
export function returnValueToLogString(returnValue: unknown): string {
    const returnValueMessage = 'Return Value: ';
    if (returnValue === undefined) {
        return `${returnValueMessage}undefined`;
    }
    if (returnValue === null) {
        return `${returnValueMessage}null`;
    }
    try {
        return `${returnValueMessage}${JSON.stringify(returnValue)}`;
    } catch {
        return `${returnValueMessage}<Return value cannot be serialized for logging>`;
    }
}
