// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import {
    JSONRPC_CONTENT_LENGTH_HEADER,
    JSONRPC_CONTENT_TYPE_HEADER,
    JSONRPC_UUID_HEADER,
    jsonRPCContent,
    jsonRPCHeaders,
} from '../../../client/testing/testController/common/utils';

suite('Test Controller Utils: JSON RPC', () => {
    test('Empty raw data string', async () => {
        const rawDataString = '';

        const output = jsonRPCHeaders(rawDataString);
        assert.deepStrictEqual(output.headers.size, 0);
        assert.deepStrictEqual(output.remainingRawData, '');
    });

    test('Valid data empty JSON', async () => {
        const rawDataString = `${JSONRPC_CONTENT_LENGTH_HEADER}: 2\n${JSONRPC_CONTENT_TYPE_HEADER}: application/json\n${JSONRPC_UUID_HEADER}: 1234\n\n{}`;

        const rpcHeaders = jsonRPCHeaders(rawDataString);
        assert.deepStrictEqual(rpcHeaders.headers.size, 3);
        assert.deepStrictEqual(rpcHeaders.remainingRawData, '{}');
        const rpcContent = jsonRPCContent(rpcHeaders.headers, rpcHeaders.remainingRawData);
        assert.deepStrictEqual(rpcContent.extractedJSON, '{}');
    });

    test('Valid data NO JSON', async () => {
        const rawDataString = `${JSONRPC_CONTENT_LENGTH_HEADER}: 0\n${JSONRPC_CONTENT_TYPE_HEADER}: application/json\n${JSONRPC_UUID_HEADER}: 1234\n\n`;

        const rpcHeaders = jsonRPCHeaders(rawDataString);
        assert.deepStrictEqual(rpcHeaders.headers.size, 3);
        assert.deepStrictEqual(rpcHeaders.remainingRawData, '');
        const rpcContent = jsonRPCContent(rpcHeaders.headers, rpcHeaders.remainingRawData);
        assert.deepStrictEqual(rpcContent.extractedJSON, '');
    });

    test('Valid data with full JSON', async () => {
        // this is just some random JSON
        const json =
            '{"jsonrpc": "2.0", "method": "initialize", "params": {"processId": 1234, "rootPath": "/home/user/project", "rootUri": "file:///home/user/project", "capabilities": {}}, "id": 0}';
        const rawDataString = `${JSONRPC_CONTENT_LENGTH_HEADER}: ${json.length}\n${JSONRPC_CONTENT_TYPE_HEADER}: application/json\n${JSONRPC_UUID_HEADER}: 1234\n\n${json}`;

        const rpcHeaders = jsonRPCHeaders(rawDataString);
        assert.deepStrictEqual(rpcHeaders.headers.size, 3);
        assert.deepStrictEqual(rpcHeaders.remainingRawData, json);
        const rpcContent = jsonRPCContent(rpcHeaders.headers, rpcHeaders.remainingRawData);
        assert.deepStrictEqual(rpcContent.extractedJSON, json);
    });

    test('Valid data with multiple JSON', async () => {
        const json =
            '{"jsonrpc": "2.0", "method": "initialize", "params": {"processId": 1234, "rootPath": "/home/user/project", "rootUri": "file:///home/user/project", "capabilities": {}}, "id": 0}';
        const rawDataString = `${JSONRPC_CONTENT_LENGTH_HEADER}: ${json.length}\n${JSONRPC_CONTENT_TYPE_HEADER}: application/json\n${JSONRPC_UUID_HEADER}: 1234\n\n${json}`;
        const rawDataString2 = rawDataString + rawDataString;

        const rpcHeaders = jsonRPCHeaders(rawDataString2);
        assert.deepStrictEqual(rpcHeaders.headers.size, 3);
        const rpcContent = jsonRPCContent(rpcHeaders.headers, rpcHeaders.remainingRawData);
        assert.deepStrictEqual(rpcContent.extractedJSON, json);
        assert.deepStrictEqual(rpcContent.remainingRawData, rawDataString);
    });
});
