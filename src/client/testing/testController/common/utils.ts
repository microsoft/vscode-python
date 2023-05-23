// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as net from 'net';
import { traceLog } from '../../../logging';

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
export const startServer = (testIds: string): Promise<number> =>
    new Promise((resolve, reject) => {
        const server = net.createServer((socket: net.Socket) => {
            // Convert the test_ids array to JSON
            const testData = JSON.stringify(testIds);

            // Create the headers
            const headers = [`Content-Length: ${Buffer.byteLength(testData)}`, 'Content-Type: application/json'];

            // Create the payload by concatenating the headers and the test data
            const payload = `${headers.join('\r\n')}\r\n\r\n${testData}`;

            // Send the payload to the socket
            socket.write(payload);

            // Handle socket events
            socket.on('data', (data) => {
                traceLog('Received data:', data.toString());
            });

            socket.on('end', () => {
                traceLog('Client disconnected');
            });
        });

        server.listen(0, () => {
            const { port } = server.address() as net.AddressInfo;
            traceLog(`Server listening on port ${port}`);
            resolve(port);
        });

        server.on('error', (error: Error) => {
            reject(error);
        });
    });
