// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as path from 'path';
import { EXTENSION_ROOT_DIR } from '../../../../client/common/constants';
import '../../../../client/common/extensions';
import * as launchers from '../../../../client/debugger/extension/adapter/remoteLaunchers';

suite('External ptvsd Debugger Launcher', () => {
    [
        {
            testName: 'When path to ptvsd launcher does not contains spaces',
            path: path.join('path', 'to', 'ptvsd_launcher'),
            expectedPath: 'path/to/ptvsd_launcher'
        },
        {
            testName: 'When path to ptvsd launcher contains spaces',
            path: path.join('path', 'to', 'ptvsd_launcher', 'with spaces'),
            expectedPath: '"path/to/ptvsd_launcher/with spaces"'
        }
    ].forEach((testParams) => {
        suite(testParams.testName, async () => {
            test('Test remote debug launcher args (and do not wait for debugger to attach)', async () => {
                const args = launchers.getPtvsdLauncherScriptArgs(
                    {
                        host: 'something',
                        port: 1234,
                        waitUntilDebuggerAttaches: false
                    },
                    testParams.path
                );
                const expectedArgs = [testParams.expectedPath, '--default', '--host', 'something', '--port', '1234'];
                expect(args).to.be.deep.equal(expectedArgs);
            });
            test('Test remote debug launcher args (and wait for debugger to attach)', async () => {
                const args = launchers.getPtvsdLauncherScriptArgs(
                    {
                        host: 'something',
                        port: 1234,
                        waitUntilDebuggerAttaches: true
                    },
                    testParams.path
                );
                const expectedArgs = [
                    testParams.expectedPath,
                    '--default',
                    '--host',
                    'something',
                    '--port',
                    '1234',
                    '--wait'
                ];
                expect(args).to.be.deep.equal(expectedArgs);
            });
        });
    });
});

suite('External debugpy Debugger Launcher', () => {
    [
        {
            testName: 'When path to debugpy does not contains spaces',
            path: path.join('path', 'to', 'debugpy'),
            expectedPath: 'path/to/debugpy'
        },
        {
            testName: 'When path to debugpy contains spaces',
            path: path.join('path', 'to', 'debugpy', 'with spaces'),
            expectedPath: '"path/to/debugpy/with spaces"'
        }
    ].forEach((testParams) => {
        suite(testParams.testName, async () => {
            test('Test remote debug launcher args (and do not wait for debugger to attach)', async () => {
                const args = launchers.getDebugpyLauncherArgs(
                    {
                        host: 'something',
                        port: 1234,
                        waitUntilDebuggerAttaches: false
                    },
                    testParams.path
                );
                const expectedArgs = [testParams.expectedPath, '--listen', 'something:1234'];
                expect(args).to.be.deep.equal(expectedArgs);
            });
            test('Test remote debug launcher args (and wait for debugger to attach)', async () => {
                const args = launchers.getDebugpyLauncherArgs(
                    {
                        host: 'something',
                        port: 1234,
                        waitUntilDebuggerAttaches: true
                    },
                    testParams.path
                );
                const expectedArgs = [testParams.expectedPath, '--listen', 'something:1234', '--wait-for-client'];
                expect(args).to.be.deep.equal(expectedArgs);
            });
        });
    });
});

suite('Path To Debugger Package', () => {
    const pathToPythonLibDir = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'lib', 'python');
    test('Path to debugpy debugger package', () => {
        const actual = launchers.getDebugpyPackagePath();
        const expected = path.join(pathToPythonLibDir, 'debugpy', 'no_wheels', 'debugpy');
        expect(actual).to.be.deep.equal(expected);
    });
});
