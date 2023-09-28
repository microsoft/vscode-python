// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import {
    JSONRPC_CONTENT_LENGTH_HEADER,
    JSONRPC_CONTENT_TYPE_HEADER,
    JSONRPC_UUID_HEADER,
    ExtractJsonRPCData,
    parseJsonRPCHeadersAndData,
    splitTestNameWithRegex,
} from '../../../client/testing/testController/common/utils';

suite('Test Controller Utils: JSON RPC', () => {
    test('Empty raw data string', async () => {
        const rawDataString = '';

        const output = parseJsonRPCHeadersAndData(rawDataString);
        assert.deepStrictEqual(output.headers.size, 0);
        assert.deepStrictEqual(output.remainingRawData, '');
    });

    test('Valid data empty JSON', async () => {
        const rawDataString = `${JSONRPC_CONTENT_LENGTH_HEADER}: 2\n${JSONRPC_CONTENT_TYPE_HEADER}: application/json\n${JSONRPC_UUID_HEADER}: 1234\n\n{}`;

        const rpcHeaders = parseJsonRPCHeadersAndData(rawDataString);
        assert.deepStrictEqual(rpcHeaders.headers.size, 3);
        assert.deepStrictEqual(rpcHeaders.remainingRawData, '{}');
        const rpcContent = ExtractJsonRPCData(rpcHeaders.headers.get('Content-Length'), rpcHeaders.remainingRawData);
        assert.deepStrictEqual(rpcContent.extractedJSON, '{}');
    });

    test('Valid data NO JSON', async () => {
        const rawDataString = `${JSONRPC_CONTENT_LENGTH_HEADER}: 0\n${JSONRPC_CONTENT_TYPE_HEADER}: application/json\n${JSONRPC_UUID_HEADER}: 1234\n\n`;

        const rpcHeaders = parseJsonRPCHeadersAndData(rawDataString);
        assert.deepStrictEqual(rpcHeaders.headers.size, 3);
        assert.deepStrictEqual(rpcHeaders.remainingRawData, '');
        const rpcContent = ExtractJsonRPCData(rpcHeaders.headers.get('Content-Length'), rpcHeaders.remainingRawData);
        assert.deepStrictEqual(rpcContent.extractedJSON, '');
    });

    test('Valid data with full JSON', async () => {
        // this is just some random JSON
        const json =
            '{"jsonrpc": "2.0", "method": "initialize", "params": {"processId": 1234, "rootPath": "/home/user/project", "rootUri": "file:///home/user/project", "capabilities": {}}, "id": 0}';
        const rawDataString = `${JSONRPC_CONTENT_LENGTH_HEADER}: ${json.length}\n${JSONRPC_CONTENT_TYPE_HEADER}: application/json\n${JSONRPC_UUID_HEADER}: 1234\n\n${json}`;

        const rpcHeaders = parseJsonRPCHeadersAndData(rawDataString);
        assert.deepStrictEqual(rpcHeaders.headers.size, 3);
        assert.deepStrictEqual(rpcHeaders.remainingRawData, json);
        const rpcContent = ExtractJsonRPCData(rpcHeaders.headers.get('Content-Length'), rpcHeaders.remainingRawData);
        assert.deepStrictEqual(rpcContent.extractedJSON, json);
    });

    test('Valid data with multiple JSON', async () => {
        const json =
            '{"jsonrpc": "2.0", "method": "initialize", "params": {"processId": 1234, "rootPath": "/home/user/project", "rootUri": "file:///home/user/project", "capabilities": {}}, "id": 0}';
        const rawDataString = `${JSONRPC_CONTENT_LENGTH_HEADER}: ${json.length}\n${JSONRPC_CONTENT_TYPE_HEADER}: application/json\n${JSONRPC_UUID_HEADER}: 1234\n\n${json}`;
        const rawDataString2 = rawDataString + rawDataString;

        const rpcHeaders = parseJsonRPCHeadersAndData(rawDataString2);
        assert.deepStrictEqual(rpcHeaders.headers.size, 3);
        const rpcContent = ExtractJsonRPCData(rpcHeaders.headers.get('Content-Length'), rpcHeaders.remainingRawData);
        assert.deepStrictEqual(rpcContent.extractedJSON, json);
        assert.deepStrictEqual(rpcContent.remainingRawData, rawDataString);
    });
});

suite('Test Controller Utils: Other', () => {
    interface TestCase {
        name: string;
        input: string;
        expectedParent: string;
        expectedSubtest: string;
    }

    const testCases: Array<TestCase> = [
        {
            name: 'Single parameter, named',
            input: 'test_package.ClassName.test_method (param=value)',
            expectedParent: 'test_package.ClassName.test_method',
            expectedSubtest: '(param=value)',
        },
        {
            name: 'Single parameter, unnamed',
            input: 'test_package.ClassName.test_method [value]',
            expectedParent: 'test_package.ClassName.test_method',
            expectedSubtest: '[value]',
        },
        {
            name: 'Multiple parameters, named',
            input: 'test_package.ClassName.test_method (param1=value1, param2=value2)',
            expectedParent: 'test_package.ClassName.test_method',
            expectedSubtest: '(param1=value1, param2=value2)',
        },
        {
            name: 'Multiple parameters, unnamed',
            input: 'test_package.ClassName.test_method [value1, value2]',
            expectedParent: 'test_package.ClassName.test_method',
            expectedSubtest: '[value1, value2]',
        },
        {
            name: 'Names with special characters',
            input: 'test_package.ClassName.test_method (param1=value/1, param2=value+2)',
            expectedParent: 'test_package.ClassName.test_method',
            expectedSubtest: '(param1=value/1, param2=value+2)',
        },
        {
            name: 'Names with spaces',
            input: 'test_package.ClassName.test_method ["a b c d"]',
            expectedParent: 'test_package.ClassName.test_method',
            expectedSubtest: '["a b c d"]',
        },
    ];

    testCases.forEach((testCase) => {
        test(`splitTestNameWithRegex: ${testCase.name}`, () => {
            const splitResult = splitTestNameWithRegex(testCase.input);
            assert.deepStrictEqual(splitResult, [testCase.expectedParent, testCase.expectedSubtest]);
        });
    });
});
