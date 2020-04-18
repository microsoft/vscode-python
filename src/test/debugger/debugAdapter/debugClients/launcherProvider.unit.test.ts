// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';
import { EXTENSION_ROOT_DIR } from '../../../../client/common/constants';
import {
    DebuggerLauncherScriptProvider,
    NoDebugLauncherScriptProvider
} from '../../../../client/debugger/debugAdapter/DebugClients/launcherProvider';

const expectedPath = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'ptvsd_launcher.py');

// tslint:disable-next-line:max-func-body-length
suite('Debugger - Launcher Script Provider', () => {
    test('Ensure launcher script exists', async () => {
        expect(await fs.pathExists(expectedPath)).to.be.deep.equal(true, 'Debugger launcher script does not exist');
    });
    const testsForLaunchProvider = [
        {
            testName: 'When path to ptvsd launcher does not contains spaces',
            path: path.join('path', 'to', 'ptvsd_launcher'),
            expectedPath: path.join('path', 'to', 'ptvsd_launcher')
        },
        {
            testName: 'When path to ptvsd launcher contains spaces',
            path: path.join('path', 'to', 'ptvsd_launcher', 'with spaces'),
            expectedPath: path.join('path', 'to', 'ptvsd_launcher', 'with spaces')
        }
    ];

    testsForLaunchProvider.forEach((testParams) => {
        suite(testParams.testName, async () => {
            test('Test debug launcher args', async () => {
                const args = new DebuggerLauncherScriptProvider(testParams.path).getLauncherArgs({
                    host: 'something',
                    port: 1234
                });
                const expectedArgs = [
                    testParams.expectedPath,
                    '--default',
                    '--client',
                    '--host',
                    'something',
                    '--port',
                    '1234'
                ];
                expect(args).to.be.deep.equal(expectedArgs);
            });
            test('Test non-debug launcher args', async () => {
                const args = new NoDebugLauncherScriptProvider(testParams.path).getLauncherArgs({
                    host: 'something',
                    port: 1234
                });
                const expectedArgs = [
                    testParams.expectedPath,
                    '--default',
                    '--nodebug',
                    '--client',
                    '--host',
                    'something',
                    '--port',
                    '1234'
                ];
                expect(args).to.be.deep.equal(expectedArgs);
            });
            test('Test debug launcher args and custom ptvsd', async () => {
                const args = new DebuggerLauncherScriptProvider(testParams.path).getLauncherArgs({
                    host: 'something',
                    port: 1234,
                    customDebugger: true
                });
                const expectedArgs = [
                    testParams.expectedPath,
                    '--custom',
                    '--client',
                    '--host',
                    'something',
                    '--port',
                    '1234'
                ];
                expect(args).to.be.deep.equal(expectedArgs);
            });
            test('Test non-debug launcher args and custom ptvsd', async () => {
                const args = new NoDebugLauncherScriptProvider(testParams.path).getLauncherArgs({
                    host: 'something',
                    port: 1234,
                    customDebugger: true
                });
                const expectedArgs = [
                    testParams.expectedPath,
                    '--custom',
                    '--nodebug',
                    '--client',
                    '--host',
                    'something',
                    '--port',
                    '1234'
                ];
                expect(args).to.be.deep.equal(expectedArgs);
            });
        });
    });
});
