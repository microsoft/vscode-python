// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export function fixLogLines(content: string): string {
    const lines = content.split(/\r?\n/g);
    return `${lines.join('\r\n')}\r\n`;
}
export interface IJSONRPCMessage {
    headers: Map<string, string>;
    extractedData: string;
    remainingRawData: string;
}

export function jsonRPCProcessor(rawData: string): IJSONRPCMessage {
    const lines = rawData.split('\n');
    let remainingRawData = '';
    const headerMap = new Map<string, string>();
    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (line === '') {
            remainingRawData = lines.slice(i + 1).join('\n');
            break;
        }
        const [key, value] = line.split(':');
        if (['Content-Length', 'Content-Type', 'Request-uuid'].includes(key)) {
            headerMap.set(key.trim(), value.trim());
        }
    }

    const length = parseInt(headerMap.get('Content-Length') ?? '0', 10);
    const data = remainingRawData.slice(0, length);
    remainingRawData = remainingRawData.slice(length);
    return {
        headers: headerMap,
        extractedData: data,
        remainingRawData,
    };
}
