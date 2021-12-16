// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export const DEFAULT_TEST_PORT = 45454;

export function fixLogLines(content: string): string {
    const lines = content.split(/\r?\n/g);
    return `${lines.join('\r\n')}\r\n`;
}
