// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import * as assert from 'assert';
import { Uri } from 'vscode';
import { RawDiscoveredTests } from '../../../../client/testing/common/services/types';
import { updateTestRoot } from '../../../../client/testing/testController/common/testItemUtilities';
import { WorkspaceTestRoot } from '../../../../client/testing/testController/common/workspaceTestRoot';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../../constants';

suite('Discovered test parser', () => {
    test('Parse discovered test JSON', () => {
        const testRootPath = path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'someTestRoot');
        const testRoot = WorkspaceTestRoot.create({
            id: 'pytest',
            uri: Uri.file(testRootPath),
            label: 'Pytest Tests',
        });
        const data = {
            rootid: '.',
            root: path.join(testRootPath, 'tests'),
            parents: [
                {
                    id: './test_math.py',
                    kind: 'file',
                    name: 'test_math.py',
                    parentid: '.',
                    relpath: './test_math.py',
                },
                {
                    id: './test_math.py::test_numbers2',
                    kind: 'function',
                    name: 'test_numbers2',
                    parentid: './test_math.py',
                },
                {
                    id: './test_str.py',
                    kind: 'file',
                    name: 'test_str.py',
                    parentid: '.',
                    relpath: './test_str.py',
                },
                { id: './test_str.py::test_str2', kind: 'function', name: 'test_str2', parentid: './test_str.py' },
            ],
            tests: [
                {
                    id: './test_math.py::test_numbers',
                    name: 'test_numbers',
                    source: './test_math.py:4',
                    markers: [],
                    parentid: './test_math.py',
                },
                {
                    id: './test_math.py::test_numbers2[x0]',
                    name: 'test_numbers2[x0]',
                    source: './test_math.py:8',
                    markers: [],
                    parentid: './test_math.py::test_numbers2',
                },
                {
                    id: './test_math.py::test_numbers2[x1]',
                    name: 'test_numbers2[x1]',
                    source: './test_math.py:8',
                    markers: [],
                    parentid: './test_math.py::test_numbers2',
                },
                {
                    id: './test_math.py::test_numbers2[x2]',
                    name: 'test_numbers2[x2]',
                    source: './test_math.py:8',
                    markers: [],
                    parentid: './test_math.py::test_numbers2',
                },
                {
                    id: './test_math.py::test_numbers_skip',
                    name: 'test_numbers_skip',
                    source: './test_math.py:13',
                    markers: ['skip'],
                    parentid: './test_math.py',
                },
                {
                    id: './test_math.py::test_failing',
                    name: 'test_failing',
                    source: './test_math.py:18',
                    markers: [],
                    parentid: './test_math.py',
                },
                {
                    id: './test_math.py::test_one',
                    name: 'test_one',
                    source: './test_math.py:22',
                    markers: [],
                    parentid: './test_math.py',
                },
                {
                    id: './test_str.py::test_str',
                    name: 'test_str',
                    source: './test_str.py:4',
                    markers: [],
                    parentid: './test_str.py',
                },
                {
                    id: './test_str.py::test_str2[x0]',
                    name: 'test_str2[x0]',
                    source: './test_str.py:8',
                    markers: [],
                    parentid: './test_str.py::test_str2',
                },
                {
                    id: './test_str.py::test_str2[x1]',
                    name: 'test_str2[x1]',
                    source: './test_str.py:8',
                    markers: [],
                    parentid: './test_str.py::test_str2',
                },
                {
                    id: './test_str.py::test_str2[x2]',
                    name: 'test_str2[x2]',
                    source: './test_str.py:8',
                    markers: [],
                    parentid: './test_str.py::test_str2',
                },
                {
                    id: './test_str.py::test_str_skip',
                    name: 'test_str_skip',
                    source: './test_str.py:13',
                    markers: ['skip'],
                    parentid: './test_str.py',
                },
                {
                    id: './test_str.py::test_another_test',
                    name: 'test_another_test',
                    source: './test_str.py:18',
                    markers: [],
                    parentid: './test_str.py',
                },
            ],
        };
        updateTestRoot(testRoot, data as RawDiscoveredTests);
        assert.deepStrictEqual(testRoot.children.size, 2);

        const testFiles = Array.from(testRoot.children.keys());
        assert.deepStrictEqual(testFiles, [path.join(data.root, 'test_math.py'), path.join(data.root, 'test_str.py')]);

        const testMathFile = testRoot.children.get(testFiles[0]);
        assert.notDeepStrictEqual(testMathFile, undefined);
        const testStrFile = testRoot.children.get(testFiles[1]);
        assert.notDeepStrictEqual(testStrFile, undefined);

        const testMathTests = Array.from(testMathFile?.children.keys() ?? []);
        const testStrTests = Array.from(testStrFile?.children.keys() ?? []);

        assert.deepStrictEqual(testMathTests, [
            `${path.join(data.root, 'test_math.py')}::test_numbers2`,
            `${path.join(data.root, 'test_math.py')}::test_numbers`,
            `${path.join(data.root, 'test_math.py')}::test_numbers_skip`,
            `${path.join(data.root, 'test_math.py')}::test_failing`,
            `${path.join(data.root, 'test_math.py')}::test_one`,
        ]);
        assert.deepStrictEqual(testStrTests, [
            `${path.join(data.root, 'test_str.py')}::test_str2`,
            `${path.join(data.root, 'test_str.py')}::test_str`,
            `${path.join(data.root, 'test_str.py')}::test_str_skip`,
            `${path.join(data.root, 'test_str.py')}::test_another_test`,
        ]);
    });
});
