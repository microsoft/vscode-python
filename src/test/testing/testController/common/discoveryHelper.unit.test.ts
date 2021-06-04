// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as path from 'path';
import * as typeMoq from 'typemoq';
import { Uri } from 'vscode';
import { IPythonExecutionService } from '../../../../client/common/process/types';
import { PythonExecutionService } from '../../../../client/common/process/pythonExecutionService';
import { TestDiscoveryHelper } from '../../../../client/testing/testController/common/discoveryHelper';
import { TestPythonExecutionFactory } from './testClasses';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../../constants';

/* eslint-disable class-methods-use-this */

suite('Test discovery helper', () => {
    let pythonExecService: typeMoq.IMock<IPythonExecutionService>;
    setup(() => {
        pythonExecService = typeMoq.Mock.ofType<IPythonExecutionService>(PythonExecutionService);
    });
    test('Return parsed test JSON', async () => {
        const options = {
            args: ['--some', '--args'],
            cwd: 'cwd',
            workspaceFolder: Uri.file(path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'someTestRoot')),
            token: undefined,
            ignoreCache: false,
            outChannel: undefined,
        };

        const testRootPath = path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'someTestRoot', 'tests');
        const expected = [
            {
                rootid: '.',
                root: testRootPath,
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
            },
        ];

        pythonExecService
            .setup((f) =>
                f.exec(['--some', '--args'], {
                    token: undefined,
                    cwd: 'cwd',
                    throwOnStdErr: true,
                }),
            )
            .returns(() => Promise.resolve({ stdout: JSON.stringify(expected) }))
            .verifiable(typeMoq.Times.once());

        const helper = new TestDiscoveryHelper(new TestPythonExecutionFactory(pythonExecService.object));

        const actual = await helper.runTestDiscovery(options);

        assert.deepStrictEqual(actual, expected);
    });
    test('Throw error for bad JSON', async () => {
        const options = {
            args: ['--some', '--args'],
            cwd: 'cwd',
            workspaceFolder: Uri.file(path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'someTestRoot')),
            token: undefined,
            ignoreCache: false,
            outChannel: undefined,
        };

        pythonExecService
            .setup((f) =>
                f.exec(['--some', '--args'], {
                    token: undefined,
                    cwd: 'cwd',
                    throwOnStdErr: true,
                }),
            )
            .returns(() => Promise.resolve({ stdout: '[{]' }))
            .verifiable(typeMoq.Times.once());

        const helper = new TestDiscoveryHelper(new TestPythonExecutionFactory(pythonExecService.object));
        assert.rejects(helper.runTestDiscovery(options));
    });
});
