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
    mapToArgs,
    addArgIfNotExist,
    argKeyExists,
    argsToMap,
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

    test('Valid constant', async () => {
        const data = `{"cwd": "/Users/eleanorboyd/testingFiles/inc_dec_example", "status": "success", "result": {"test_dup_class.test_a.TestSomething.test_a": {"test": "test_dup_class.test_a.TestSomething.test_a", "outcome": "success", "message": "None", "traceback": null, "subtest": null}}}`;
        const secondPayload = `Content-Length: 270
Content-Type: application/json
Request-uuid: 496c86b1-608f-4886-9436-ec00538e144c

${data}`;
        const payload = `Content-Length: 270
Content-Type: application/json
Request-uuid: 496c86b1-608f-4886-9436-ec00538e144c

${data}${secondPayload}`;

        const rpcHeaders = parseJsonRPCHeadersAndData(payload);
        assert.deepStrictEqual(rpcHeaders.headers.size, 3);
        const rpcContent = ExtractJsonRPCData(rpcHeaders.headers.get('Content-Length'), rpcHeaders.remainingRawData);
        assert.deepStrictEqual(rpcContent.extractedJSON, data);
        assert.deepStrictEqual(rpcContent.remainingRawData, secondPayload);
    });
    test('Valid content length as only header with carriage return', async () => {
        const payload = `Content-Length: 7
        `;

        const rpcHeaders = parseJsonRPCHeadersAndData(payload);
        assert.deepStrictEqual(rpcHeaders.headers.size, 1);
        const rpcContent = ExtractJsonRPCData(rpcHeaders.headers.get('Content-Length'), rpcHeaders.remainingRawData);
        assert.deepStrictEqual(rpcContent.extractedJSON, '');
        assert.deepStrictEqual(rpcContent.remainingRawData, '');
    });
    test('Valid content length header with no value', async () => {
        const payload = `Content-Length:`;

        const rpcHeaders = parseJsonRPCHeadersAndData(payload);
        const rpcContent = ExtractJsonRPCData(rpcHeaders.headers.get('Content-Length'), rpcHeaders.remainingRawData);
        assert.deepStrictEqual(rpcContent.extractedJSON, '');
        assert.deepStrictEqual(rpcContent.remainingRawData, '');
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
    suite('Test Controller Utils: Args Mapping', () => {
        test('Converts map with mixed values to array of strings', async () => {
            const inputMap = {
                key1: 'value1',
                key2: null,
                key3: undefined,
                key4: 'value4',
            };
            const expectedOutput = ['key1=value1', 'key2', 'key4=value4'];

            const result = mapToArgs(inputMap);

            assert.deepStrictEqual(result, expectedOutput);
        });

        test('Returns an empty array for an empty map', async () => {
            const inputMap = {};
            const expectedOutput: unknown[] = [];

            const result = mapToArgs(inputMap);

            assert.deepStrictEqual(result, expectedOutput);
        });

        test('Skips undefined values', async () => {
            const inputMap = {
                key1: undefined,
                key2: undefined,
            };
            const expectedOutput: unknown[] = [];

            const result = mapToArgs(inputMap);

            assert.deepStrictEqual(result, expectedOutput);
        });

        test('Handles null values correctly', async () => {
            const inputMap = {
                key1: null,
                key2: null,
            };
            const expectedOutput = ['key1', 'key2'];

            const result = mapToArgs(inputMap);

            assert.deepStrictEqual(result, expectedOutput);
        });
        test('Adds new argument if it does not exist', () => {
            const map = {};
            const argKey = 'newKey';
            const argValue = 'newValue';

            const updatedMap = addArgIfNotExist(map, argKey, argValue);

            assert.deepStrictEqual(updatedMap, { [argKey]: argValue });
        });

        test('Does not overwrite existing argument', () => {
            const map = { existingKey: 'existingValue' };
            const argKey = 'existingKey';
            const argValue = 'newValue';

            const updatedMap = addArgIfNotExist(map, argKey, argValue);

            assert.deepStrictEqual(updatedMap, { [argKey]: 'existingValue' });
        });

        test('Handles null value for new key', () => {
            const map = {};
            const argKey = 'nullKey';
            const argValue = null;

            const updatedMap = addArgIfNotExist(map, argKey, argValue);

            assert.deepStrictEqual(updatedMap, { [argKey]: argValue });
        });

        test('Ignores addition if key exists with null value', () => {
            const map = { nullKey: null };
            const argKey = 'nullKey';
            const argValue = 'newValue';

            const updatedMap = addArgIfNotExist(map, argKey, argValue);

            assert.deepStrictEqual(updatedMap, { [argKey]: null });
        });

        test('Accepts addition if key exists with undefined value', () => {
            const map = { undefinedKey: undefined };
            const argKey = 'undefinedKey';
            const argValue = 'newValue';

            // Attempting to add a key that is explicitly set to undefined
            const updatedMap = addArgIfNotExist(map, argKey, argValue);

            // Expect the map to remain unchanged because the key exists as undefined
            assert.strictEqual(map[argKey], argValue);
            assert.deepStrictEqual(updatedMap, { [argKey]: argValue });
        });
        test('Complex test for argKeyExists with various key types', () => {
            const map = {
                stringKey: 'stringValue',
                nullKey: null,
                // Note: not adding an 'undefinedKey' explicitly since it's not present and hence undefined by default
            };

            // Should return true for keys that are present, even with a null value
            assert.strictEqual(
                argKeyExists(map, 'stringKey'),
                true,
                "Failed to recognize 'stringKey' which has a string value.",
            );
            assert.strictEqual(
                argKeyExists(map, 'nullKey'),
                true,
                "Failed to recognize 'nullKey' which has a null value.",
            );

            // Should return false for keys that are not present
            assert.strictEqual(
                argKeyExists(map, 'undefinedKey'),
                false,
                "Incorrectly recognized 'undefinedKey' as existing.",
            );
        });
        test('Converts array of strings with "=" into a map', () => {
            const args = ['key1=value1', 'key2=value2'];
            const expectedMap = { key1: 'value1', key2: 'value2' };

            const resultMap = argsToMap(args);

            assert.deepStrictEqual(resultMap, expectedMap);
        });

        test('Assigns null to keys without "="', () => {
            const args = ['key1', 'key2'];
            const expectedMap = { key1: null, key2: null };

            const resultMap = argsToMap(args);

            assert.deepStrictEqual(resultMap, expectedMap);
        });

        test('Handles mixed keys with and without "="', () => {
            const args = ['key1=value1', 'key2'];
            const expectedMap = { key1: 'value1', key2: null };

            const resultMap = argsToMap(args);

            assert.deepStrictEqual(resultMap, expectedMap);
        });

        test('Handles strings with multiple "=" characters', () => {
            const args = ['key1=part1=part2'];
            const expectedMap = { key1: 'part1=part2' };

            const resultMap = argsToMap(args);

            assert.deepStrictEqual(resultMap, expectedMap);
        });

        test('Returns an empty map for an empty input array', () => {
            const args: ReadonlyArray<string> = [];
            const expectedMap = {};

            const resultMap = argsToMap(args);

            assert.deepStrictEqual(resultMap, expectedMap);
        });
    });
});
