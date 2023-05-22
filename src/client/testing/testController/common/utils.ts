// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export function fixLogLines(content: string): string {
    const lines = content.split(/\r?\n/g);
    return `${lines.join('\r\n')}\r\n`;
}
export interface IJSONRPCContent {
    extractedJSON: string;
    remainingRawData: string;
}

export interface IJSONRPCHeaders {
    headers: Map<string, string>;
    remainingRawData: string;
}

export const JSONRPC_UUID_HEADER = 'Request-uuid';
export const JSONRPC_CONTENT_LENGTH_HEADER = 'Content-Length';
export const JSONRPC_CONTENT_TYPE_HEADER = 'Content-Type';

export function jsonRPCHeaders(rawData: string): IJSONRPCHeaders {
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
        if ([JSONRPC_UUID_HEADER, JSONRPC_CONTENT_LENGTH_HEADER, JSONRPC_CONTENT_TYPE_HEADER].includes(key)) {
            headerMap.set(key.trim(), value.trim());
        }
    }

    return {
        headers: headerMap,
        remainingRawData,
    };
}

export function jsonRPCContent(headers: Map<string, string>, rawData: string): IJSONRPCContent {
    const length = parseInt(headers.get('Content-Length') ?? '0', 10);
    const data = rawData.slice(0, length);
    const remainingRawData = rawData.slice(length);
    return {
        extractedJSON: data,
        remainingRawData,
    };
}
