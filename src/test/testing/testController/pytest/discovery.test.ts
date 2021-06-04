// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as path from 'path';
import * as typeMoq from 'typemoq';
import { Uri } from 'vscode';
import { RawDiscoveredTests, RawTest } from '../../../../client/testing/common/services/types';
import { TestDiscoveryHelper } from '../../../../client/testing/testController/common/discoveryHelper';
import { ITestDiscoveryHelper } from '../../../../client/testing/testController/common/types';
import { PytestDiscoveryService } from '../../../../client/testing/testController/pytest/discovery';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../../constants';

suite('Pytest discovery tests', () => {
    let discoveryHelper: typeMoq.IMock<ITestDiscoveryHelper>;
    const testWorkspacePath = path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'someTestRoot');
    const testRootDir = path.join(testWorkspacePath, 'tests');

    setup(() => {
        discoveryHelper = typeMoq.Mock.ofType<ITestDiscoveryHelper>(TestDiscoveryHelper);
    });

    test('Discover pytest tests', async () => {
        const testData: RawDiscoveredTests[] = [
            {
                rootid: '.',
                root: testRootDir,
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
                    } as RawTest,
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
            } as RawDiscoveredTests,
        ];
        discoveryHelper.setup((d) => d.runTestDiscovery(typeMoq.It.isAny())).returns(() => Promise.resolve(testData));

        const pytestDiscovery = new PytestDiscoveryService(discoveryHelper.object);
        const actual = await pytestDiscovery.discoverWorkspaceTests({
            workspaceFolder: Uri.file(testWorkspacePath),
            args: [],
            cwd: testRootDir,
            ignoreCache: false,
        });

        assert.notDeepStrictEqual(actual, undefined);
    });
});
