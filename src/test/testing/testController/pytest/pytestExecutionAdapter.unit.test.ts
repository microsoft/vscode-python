/* eslint-disable @typescript-eslint/no-explicit-any */
//  Copyright (c) Microsoft Corporation. All rights reserved.
//  Licensed under the MIT License.
import * as assert from 'assert';
import { TestRun, Uri } from 'vscode';
import * as typeMoq from 'typemoq';
import * as sinon from 'sinon';
import * as path from 'path';
import { IConfigurationService, ITestOutputChannel } from '../../../../client/common/types';
import { ITestServer } from '../../../../client/testing/testController/common/types';
import {
    IPythonExecutionFactory,
    IPythonExecutionService,
    SpawnOptions,
} from '../../../../client/common/process/types';
import { createDeferred, Deferred } from '../../../../client/common/utils/async';
import { PytestTestExecutionAdapter } from '../../../../client/testing/testController/pytest/pytestExecutionAdapter';
import { ITestDebugLauncher, LaunchOptions } from '../../../../client/testing/common/types';
import * as util from '../../../../client/testing/testController/common/utils';
import { EXTENSION_ROOT_DIR } from '../../../../client/constants';

suite('pytest test execution adapter', () => {
    let testServer: typeMoq.IMock<ITestServer>;
    let configService: IConfigurationService;
    let execFactory = typeMoq.Mock.ofType<IPythonExecutionFactory>();
    let adapter: PytestTestExecutionAdapter;
    let execService: typeMoq.IMock<IPythonExecutionService>;
    let deferred: Deferred<void>;
    let debugLauncher: typeMoq.IMock<ITestDebugLauncher>;
    (global as any).EXTENSION_ROOT_DIR = EXTENSION_ROOT_DIR;
    let myTestPath: string;
    let startTestIdServerStub: sinon.SinonStub<any, any>;

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
        startTestIdServerStub = sinon.stub(util, 'startTestIdServer').returns(Promise.resolve(54321));

        execFactory.setup((p) => ((p as unknown) as any).then).returns(() => undefined);
        execService.setup((p) => ((p as unknown) as any).then).returns(() => undefined);
        debugLauncher.setup((p) => ((p as unknown) as any).then).returns(() => undefined);
        myTestPath = path.join('/', 'my', 'test', 'path', '/');
    });
    teardown(() => {
        sinon.restore();
    });
    test('startTestIdServer called with correct testIds', async () => {
        const uri = Uri.file(myTestPath);
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

        const testIds = ['test1id', 'test2id'];
        await adapter.runTests(uri, testIds, false, testRun.object, execFactory.object);

        sinon.assert.calledWithExactly(startTestIdServerStub, testIds);
    });
    test('pytest execution called with correct args', async () => {
        const uri = Uri.file(myTestPath);
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
        await adapter.runTests(uri, [], false, testRun.object, execFactory.object);

        const pathToPythonFiles = path.join(EXTENSION_ROOT_DIR, 'pythonFiles');
        const pathToPythonScript = path.join(pathToPythonFiles, 'vscode_pytest', 'run_pytest_script.py');
        const expectedArgs = [pathToPythonScript, '--rootdir', myTestPath];
        const expectedExtraVariables = {
            PYTHONPATH: pathToPythonFiles,
            TEST_UUID: 'uuid123',
            TEST_PORT: '12345',
        };
        //  execService.verify((x) => x.exec(expectedArgs, typeMoq.It.isAny()), typeMoq.Times.once());
        execService.verify(
            (x) =>
                x.exec(
                    expectedArgs,
                    typeMoq.It.is<SpawnOptions>((options) => {
                        assert.equal(options.extraVariables?.PYTHONPATH, expectedExtraVariables.PYTHONPATH);
                        assert.equal(options.extraVariables?.TEST_UUID, expectedExtraVariables.TEST_UUID);
                        assert.equal(options.extraVariables?.TEST_PORT, expectedExtraVariables.TEST_PORT);
                        assert.equal(options.extraVariables?.RUN_TEST_IDS_PORT, '54321');
                        assert.equal(options.cwd, uri.fsPath);
                        assert.equal(options.throwOnStdErr, true);
                        return true;
                    }),
                ),
            typeMoq.Times.once(),
        );
    });
    test('Debug launched correctly for pytest', async () => {
        const uri = Uri.file(myTestPath);
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
                        assert.deepEqual(launchOptions.args, ['--rootdir', myTestPath, '--capture', 'no']);
                        assert.equal(launchOptions.testProvider, 'pytest');
                        assert.equal(launchOptions.pytestPort, '12345');
                        assert.equal(launchOptions.pytestUUID, 'uuid123');
                        assert.strictEqual(launchOptions.runTestIdsPort, '54321');
                        return true;
                    }),
                    typeMoq.It.isAny(),
                ),
            typeMoq.Times.once(),
        );
    });
});
