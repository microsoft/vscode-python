// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as path from 'path';
import * as typemoq from 'typemoq';
import { Uri } from 'vscode';
import * as sinon from 'sinon';
import { IConfigurationService, ITestOutputChannel } from '../../../../client/common/types';
import { EXTENSION_ROOT_DIR } from '../../../../client/constants';
import { ITestServer, TestCommandOptions } from '../../../../client/testing/testController/common/types';
import { UnittestTestExecutionAdapter } from '../../../../client/testing/testController/unittest/testExecutionAdapter';
import * as util from '../../../../client/testing/testController/common/utils';

suite('Unittest test execution adapter', () => {
    let stubConfigSettings: IConfigurationService;
    let outputChannel: typemoq.IMock<ITestOutputChannel>;

    setup(() => {
        stubConfigSettings = ({
            getSettings: () => ({
                testing: { unittestArgs: ['-v', '-s', '.', '-p', 'test*'] },
            }),
        } as unknown) as IConfigurationService;
        outputChannel = typemoq.Mock.ofType<ITestOutputChannel>();
        sinon.stub(util, 'startTestIdServer').returns(Promise.resolve(54321));
    });
    teardown(() => {
        sinon.restore();
    });

    test('runTests should send the run command to the test server', async () => {
        let options: TestCommandOptions | undefined;

        const stubTestServer = ({
            sendCommand(opt: TestCommandOptions, runTestIdPort?: string): Promise<void> {
                delete opt.outChannel;
                options = opt;
                assert(runTestIdPort !== undefined);
                return Promise.resolve();
            },
            onRunDataReceived: () => {
                // no body
            },
            createUUID: () => '123456789',
        } as unknown) as ITestServer;

        const uri = Uri.file('/foo/bar');
        const script = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'unittestadapter', 'execution.py');

        const adapter = new UnittestTestExecutionAdapter(stubTestServer, stubConfigSettings, outputChannel.object);
        const testIds = ['test1id', 'test2id'];
        adapter.runTests(uri, testIds, false).then(() => {
            const expectedOptions: TestCommandOptions = {
                workspaceFolder: uri,
                command: { script, args: ['--udiscovery', '-v', '-s', '.', '-p', 'test*'] },
                cwd: uri.fsPath,
                uuid: '123456789',
                debugBool: false,
                testIds,
            };
            assert.deepStrictEqual(options, expectedOptions);
        });
    });
    test('runTests should respect settings.testing.cwd when present', async () => {
        stubConfigSettings = ({
            getSettings: () => ({
                testing: { unittestArgs: ['-v', '-s', '.', '-p', 'test*'], cwd: '/foo' },
            }),
        } as unknown) as IConfigurationService;
        let options: TestCommandOptions | undefined;

        const stubTestServer = ({
            sendCommand(opt: TestCommandOptions, runTestIdPort?: string): Promise<void> {
                delete opt.outChannel;
                options = opt;
                assert(runTestIdPort !== undefined);
                return Promise.resolve();
            },
            onRunDataReceived: () => {
                // no body
            },
            createUUID: () => '123456789',
        } as unknown) as ITestServer;

        const newCwd = '/foo';
        const uri = Uri.file('/foo/bar');
        const script = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'unittestadapter', 'execution.py');

        const adapter = new UnittestTestExecutionAdapter(stubTestServer, stubConfigSettings, outputChannel.object);
        const testIds = ['test1id', 'test2id'];
        adapter.runTests(uri, testIds, false).then(() => {
            const expectedOptions: TestCommandOptions = {
                workspaceFolder: uri,
                command: { script, args: ['--udiscovery', '-v', '-s', '.', '-p', 'test*'] },
                cwd: newCwd,
                uuid: '123456789',
                debugBool: false,
                testIds,
            };
            assert.deepStrictEqual(options, expectedOptions);
        });
    });
});
