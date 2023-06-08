/* eslint-disable @typescript-eslint/no-explicit-any */
//  Copyright (c) Microsoft Corporation. All rights reserved.
//  Licensed under the MIT License.
import * as assert from 'assert';
import { TestRun, Uri } from 'vscode';
import * as typeMoq from 'typemoq';
import { debug } from 'console';
import * as net from 'net';
import { IConfigurationService, ITestOutputChannel } from '../../../../client/common/types';
import { DataReceivedEvent, ITestServer } from '../../../../client/testing/testController/common/types';
import {
    IPythonExecutionFactory,
    IPythonExecutionService,
    SpawnOptions,
} from '../../../../client/common/process/types';
import { createDeferred, Deferred } from '../../../../client/common/utils/async';
import { PytestTestExecutionAdapter } from '../../../../client/testing/testController/pytest/pytestExecutionAdapter';
import { ITestDebugLauncher, LaunchOptions } from '../../../../client/testing/common/types';
import { DebugLauncher } from '../../../../client/testing/common/debugLauncher';

suite('pytest test execution adapter', () => {
    let testServer: typeMoq.IMock<ITestServer>;
    let configService: IConfigurationService;
    let execFactory = typeMoq.Mock.ofType<IPythonExecutionFactory>();
    let adapter: PytestTestExecutionAdapter;
    let execService: typeMoq.IMock<IPythonExecutionService>;
    let deferred: Deferred<void>;
    let debugLauncher: typeMoq.IMock<ITestDebugLauncher>;
    setup(() => {
        testServer = typeMoq.Mock.ofType<ITestServer>();
        testServer.setup((t) => t.getPort()).returns(() => 12345);
        testServer
            .setup((t) => t.onRunDataReceived(typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns(() => ({
                dispose: () => {
                    /* no-body */
                },
            }));
        configService = ({
            getSettings: () => ({
                testing: { pytestArgs: ['.'] },
            }),
            isTestExecution: () => false,
        } as unknown) as IConfigurationService;
        execFactory = typeMoq.Mock.ofType<IPythonExecutionFactory>();
        execService = typeMoq.Mock.ofType<IPythonExecutionService>();
        debugLauncher = typeMoq.Mock.ofType<ITestDebugLauncher>();
        execFactory
            .setup((x) => x.createActivatedEnvironment(typeMoq.It.isAny()))
            .returns(() => Promise.resolve(execService.object));
        deferred = createDeferred();
        execService
            .setup((x) => x.exec(typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns(() => {
                deferred.resolve();
                return Promise.resolve({ stdout: '{}' });
            });
        debugLauncher
            .setup((d) => d.launchDebugger(typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns(() => {
                deferred.resolve();
                return Promise.resolve();
            });
        execFactory.setup((p) => ((p as unknown) as any).then).returns(() => undefined);
        execService.setup((p) => ((p as unknown) as any).then).returns(() => undefined);
        debugLauncher.setup((p) => ((p as unknown) as any).then).returns(() => undefined);
    });
    // test('onDataReceivedHandler call exec with correct args', async () => {
    //     const uri = Uri.file('/my/test/path/');
    //     const uuid = 'uuid123';
    //     // const data = { status: 'success' };
    //     testServer
    //         .setup((t) => t.onDiscoveryDataReceived(typeMoq.It.isAny(), typeMoq.It.isAny()))
    //         .returns(() => ({
    //             dispose: () => {
    //                 /* no-body */
    //             },
    //         }));
    //     testServer.setup((t) => t.createUUID(typeMoq.It.isAny())).returns(() => uuid);
    //     const outputChannel = typeMoq.Mock.ofType<ITestOutputChannel>();
    //     const testRun = typeMoq.Mock.ofType<TestRun>();
    //     adapter = new PytestTestExecutionAdapter(testServer.object, configService, outputChannel.object);
    //     await adapter.runTests(uri, [], false, testRun.object, execFactory.object);

    //     const expectedArgs = [
    //         '/Users/eleanorboyd/vscode-python/pythonFiles/vscode_pytest/run_pytest_script.py',
    //         '--rootdir',
    //         '/my/test/path/',
    //     ];
    //     const expectedExtraVariables = {
    //         PYTHONPATH: '/Users/eleanorboyd/vscode-python/pythonFiles',
    //         TEST_UUID: 'uuid123',
    //         TEST_PORT: '12345',
    //     };
    //     execService.verify(
    //         (x) =>
    //             x.exec(
    //                 expectedArgs,
    //                 typeMoq.It.is<SpawnOptions>((options) => {
    //                     assert.equal(options.extraVariables?.PYTHONPATH, expectedExtraVariables.PYTHONPATH);
    //                     assert.equal(options.extraVariables?.TEST_UUID, expectedExtraVariables.TEST_UUID);
    //                     assert.equal(options.extraVariables?.TEST_PORT, expectedExtraVariables.TEST_PORT);
    //                     assert.strictEqual(typeof options.extraVariables?.RUN_TEST_IDS_PORT, 'string');
    //                     assert.equal(options.cwd, uri.fsPath);
    //                     assert.equal(options.throwOnStdErr, true);
    //                     return true;
    //                 }),
    //             ),
    //         typeMoq.Times.once(),
    //     );
    // });
    // test('debug called if boolean true and debug launch options are correct', async () => {
    //     const uri = Uri.file('/my/test/path/');
    //     const uuid = 'uuid123';
    //     testServer
    //         .setup((t) => t.onDiscoveryDataReceived(typeMoq.It.isAny(), typeMoq.It.isAny()))
    //         .returns(() => ({
    //             dispose: () => {
    //                 /* no-body */
    //             },
    //         }));
    //     testServer.setup((t) => t.createUUID(typeMoq.It.isAny())).returns(() => uuid);
    //     const outputChannel = typeMoq.Mock.ofType<ITestOutputChannel>();
    //     const testRun = typeMoq.Mock.ofType<TestRun>();
    //     adapter = new PytestTestExecutionAdapter(testServer.object, configService, outputChannel.object);
    //     await adapter.runTests(uri, [], true, testRun.object, execFactory.object, debugLauncher.object);
    //     debugLauncher.verify(
    //         (x) =>
    //             x.launchDebugger(
    //                 typeMoq.It.is<LaunchOptions>((launchOptions) => {
    //                     assert.equal(launchOptions.cwd, uri.fsPath);
    //                     assert.deepEqual(launchOptions.args, ['--rootdir', '/my/test/path/', '--capture', 'no']);
    //                     assert.equal(launchOptions.testProvider, 'pytest');
    //                     assert.equal(launchOptions.pytestPort, '12345');
    //                     assert.equal(launchOptions.pytestUUID, 'uuid123');
    //                     assert.strictEqual(typeof launchOptions.runTestIdsPort, 'string');
    //                     return true;
    //                 }),
    //                 typeMoq.It.isAny(),
    //             ),
    //         typeMoq.Times.once(),
    //     );
    // });
    test('dafdsaljfj;a4wfadss', async () => {
        const uri = Uri.file('/my/test/path/');
        const uuid = 'uuid123';
        testServer
            .setup((t) => t.onDiscoveryDataReceived(typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns(() => ({
                dispose: () => {
                    /* no-body */
                },
            }));
        testServer.setup((t) => t.createUUID(typeMoq.It.isAny())).returns(() => uuid);
        const outputChannel = typeMoq.Mock.ofType<ITestOutputChannel>();
        const testRun = typeMoq.Mock.ofType<TestRun>();

        adapter = new PytestTestExecutionAdapter(testServer.object, configService, outputChannel.object);
        await adapter.runTests(uri, [], true, testRun.object, execFactory.object, debugLauncher.object);
        debugLauncher.verify(
            (x) =>
                x.launchDebugger(
                    typeMoq.It.is<LaunchOptions>((launchOptions) => {
                        assert.equal(launchOptions.cwd, uri.fsPath);
                        assert.deepEqual(launchOptions.args, ['--rootdir', '/my/test/path/', '--capture', 'no']);
                        assert.equal(launchOptions.testProvider, 'pytest');
                        assert.equal(launchOptions.pytestPort, '12345');
                        assert.equal(launchOptions.pytestUUID, 'uuid123');
                        assert.strictEqual(typeof launchOptions.runTestIdsPort, 'string');
                        return true;
                    }),
                    typeMoq.It.isAny(),
                ),
            typeMoq.Times.once(),
        );
    });
});
