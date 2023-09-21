/* eslint-disable @typescript-eslint/no-explicit-any */
//  Copyright (c) Microsoft Corporation. All rights reserved.
//  Licensed under the MIT License.
import * as assert from 'assert';
import { TestRun, Uri } from 'vscode';
import * as typeMoq from 'typemoq';
import * as sinon from 'sinon';
import * as path from 'path';
import { Observable } from 'rxjs/Observable';
import { IConfigurationService, ITestOutputChannel } from '../../../../client/common/types';
import { ITestServer } from '../../../../client/testing/testController/common/types';
import {
    IPythonExecutionFactory,
    IPythonExecutionService,
    Output,
    SpawnOptions,
} from '../../../../client/common/process/types';
import { createDeferred, Deferred } from '../../../../client/common/utils/async';
import { PytestTestExecutionAdapter } from '../../../../client/testing/testController/pytest/pytestExecutionAdapter';
import { ITestDebugLauncher, LaunchOptions } from '../../../../client/testing/common/types';
import * as util from '../../../../client/testing/testController/common/utils';
import { EXTENSION_ROOT_DIR } from '../../../../client/constants';
import { MockChildProcess } from '../../../mocks/mockChildProcess';
import { traceInfo } from '../../../../client/logging';

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
    let mockProc: MockChildProcess;
    let utilsStartServerStub: sinon.SinonStub;
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

        // mock out the result resolver

        // set up exec service with child process
        mockProc = new MockChildProcess('', ['']);
        const output = new Observable<Output<string>>(() => {
            /* no op */
        });
        execService = typeMoq.Mock.ofType<IPythonExecutionService>();
        execService
            .setup((x) => x.execObservable(typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns(() => ({
                proc: mockProc,
                out: output,
                dispose: () => {
                    /* no-body */
                },
            }));
        execFactory = typeMoq.Mock.ofType<IPythonExecutionFactory>();
        utilsStartServerStub = sinon.stub(util, 'startTestIdServer');
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
        execFactory.setup((p) => ((p as unknown) as any).then).returns(() => undefined);
        execService.setup((p) => ((p as unknown) as any).then).returns(() => undefined);
        debugLauncher.setup((p) => ((p as unknown) as any).then).returns(() => undefined);
        myTestPath = path.join('/', 'my', 'test', 'path', '/');
    });
    teardown(() => {
        sinon.restore();
    });
    test('startTestIdServer called with correct testIds', async () => {
        const deferred2 = createDeferred();
        const deferred3 = createDeferred();
        execFactory = typeMoq.Mock.ofType<IPythonExecutionFactory>();
        execFactory
            .setup((x) => x.createActivatedEnvironment(typeMoq.It.isAny()))
            .returns(() => {
                deferred2.resolve();
                return Promise.resolve(execService.object);
            });
        utilsStartServerStub.callsFake(() => {
            deferred3.resolve();
            return Promise.resolve(54321);
        });
        const testRun = typeMoq.Mock.ofType<TestRun>();
        testRun.setup((t) => t.token).returns(() => ({ onCancellationRequested: () => undefined } as any));
        const uri = Uri.file(myTestPath);
        const uuid = 'uuid123';
        testServer
            .setup((t) => t.onRunDataReceived(typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns(() => ({
                dispose: () => {
                    /* no-body */
                },
            }));
        testServer.setup((t) => t.createUUID(typeMoq.It.isAny())).returns(() => uuid);
        const outputChannel = typeMoq.Mock.ofType<ITestOutputChannel>();
        adapter = new PytestTestExecutionAdapter(testServer.object, configService, outputChannel.object);
        const testIds = ['test1id', 'test2id'];
        adapter.runTests(uri, testIds, false, testRun.object, execFactory.object);

        // add in await and trigger
        await deferred2.promise;
        await deferred3.promise;
        mockProc.trigger('close');

        // assert
        sinon.assert.calledWithExactly(utilsStartServerStub, testIds);
    });
    test('pytest execution called with correct args', async () => {
        const deferred2 = createDeferred();
        const deferred3 = createDeferred();
        execFactory = typeMoq.Mock.ofType<IPythonExecutionFactory>();
        execFactory
            .setup((x) => x.createActivatedEnvironment(typeMoq.It.isAny()))
            .returns(() => {
                deferred2.resolve();
                return Promise.resolve(execService.object);
            });
        utilsStartServerStub.callsFake(() => {
            deferred3.resolve();
            return Promise.resolve(54321);
        });
        const testRun = typeMoq.Mock.ofType<TestRun>();
        testRun.setup((t) => t.token).returns(() => ({ onCancellationRequested: () => undefined } as any));
        const uri = Uri.file(myTestPath);
        const uuid = 'uuid123';
        testServer
            .setup((t) => t.onRunDataReceived(typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns(() => ({
                dispose: () => {
                    /* no-body */
                },
            }));
        testServer.setup((t) => t.createUUID(typeMoq.It.isAny())).returns(() => uuid);
        const outputChannel = typeMoq.Mock.ofType<ITestOutputChannel>();
        adapter = new PytestTestExecutionAdapter(testServer.object, configService, outputChannel.object);
        adapter.runTests(uri, [], false, testRun.object, execFactory.object);

        await deferred2.promise;
        await deferred3.promise;
        mockProc.trigger('close');

        const pathToPythonFiles = path.join(EXTENSION_ROOT_DIR, 'pythonFiles');
        const pathToPythonScript = path.join(pathToPythonFiles, 'vscode_pytest', 'run_pytest_script.py');
        const expectedArgs = [pathToPythonScript, '--rootdir', myTestPath];
        const expectedExtraVariables = {
            PYTHONPATH: pathToPythonFiles,
            TEST_UUID: 'uuid123',
            TEST_PORT: '12345',
        };
        execService.verify(
            (x) =>
                x.execObservable(
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
    test('pytest execution respects settings.testing.cwd when present', async () => {
        const deferred2 = createDeferred();
        const deferred3 = createDeferred();
        execFactory = typeMoq.Mock.ofType<IPythonExecutionFactory>();
        execFactory
            .setup((x) => x.createActivatedEnvironment(typeMoq.It.isAny()))
            .returns(() => {
                deferred2.resolve();
                return Promise.resolve(execService.object);
            });
        utilsStartServerStub.callsFake(() => {
            deferred3.resolve();
            return Promise.resolve(54321);
        });
        const testRun = typeMoq.Mock.ofType<TestRun>();
        testRun.setup((t) => t.token).returns(() => ({ onCancellationRequested: () => undefined } as any));
        const newCwd = path.join('new', 'path');
        configService = ({
            getSettings: () => ({
                testing: { pytestArgs: ['.'], cwd: newCwd },
            }),
            isTestExecution: () => false,
        } as unknown) as IConfigurationService;
        const uri = Uri.file(myTestPath);
        const uuid = 'uuid123';
        testServer
            .setup((t) => t.onRunDataReceived(typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns(() => ({
                dispose: () => {
                    /* no-body */
                },
            }));
        testServer.setup((t) => t.createUUID(typeMoq.It.isAny())).returns(() => uuid);
        const outputChannel = typeMoq.Mock.ofType<ITestOutputChannel>();
        adapter = new PytestTestExecutionAdapter(testServer.object, configService, outputChannel.object);
        adapter.runTests(uri, [], false, testRun.object, execFactory.object);

        await deferred2.promise;
        await deferred3.promise;
        mockProc.trigger('close');

        const pathToPythonFiles = path.join(EXTENSION_ROOT_DIR, 'pythonFiles');
        const pathToPythonScript = path.join(pathToPythonFiles, 'vscode_pytest', 'run_pytest_script.py');
        const expectedArgs = [pathToPythonScript, '--rootdir', myTestPath];
        const expectedExtraVariables = {
            PYTHONPATH: pathToPythonFiles,
            TEST_UUID: 'uuid123',
            TEST_PORT: '12345',
        };

        execService.verify(
            (x) =>
                x.execObservable(
                    expectedArgs,
                    typeMoq.It.is<SpawnOptions>((options) => {
                        assert.equal(options.extraVariables?.PYTHONPATH, expectedExtraVariables.PYTHONPATH);
                        assert.equal(options.extraVariables?.TEST_UUID, expectedExtraVariables.TEST_UUID);
                        assert.equal(options.extraVariables?.TEST_PORT, expectedExtraVariables.TEST_PORT);
                        assert.equal(options.extraVariables?.RUN_TEST_IDS_PORT, '54321');
                        assert.equal(options.cwd, newCwd);
                        assert.equal(options.throwOnStdErr, true);
                        return true;
                    }),
                ),
            typeMoq.Times.once(),
        );
    });
    test('Debug launched correctly for pytest', async () => {
        const deferred3 = createDeferred();
        const deferredEOT = createDeferred();
        utilsStartServerStub.callsFake(() => {
            deferred3.resolve();
            return Promise.resolve(54321);
        });
        debugLauncher
            .setup((dl) => dl.launchDebugger(typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns(async () => {
                traceInfo('stubs launch debugger');
                deferredEOT.resolve();
            });
        const utilsCreateEOTStub: sinon.SinonStub = sinon.stub(util, 'createTestingDeferred');
        utilsCreateEOTStub.callsFake(() => deferredEOT);
        const testRun = typeMoq.Mock.ofType<TestRun>();
        testRun
            .setup((t) => t.token)
            .returns(
                () =>
                    ({
                        onCancellationRequested: () => undefined,
                    } as any),
            );
        const uri = Uri.file(myTestPath);
        const uuid = 'uuid123';
        testServer
            .setup((t) => t.onRunDataReceived(typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns(() => ({
                dispose: () => {
                    /* no-body */
                },
            }));
        testServer.setup((t) => t.createUUID(typeMoq.It.isAny())).returns(() => uuid);
        const outputChannel = typeMoq.Mock.ofType<ITestOutputChannel>();
        adapter = new PytestTestExecutionAdapter(testServer.object, configService, outputChannel.object);
        await adapter.runTests(uri, [], true, testRun.object, execFactory.object, debugLauncher.object);
        await deferred3.promise;
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
        testServer.verify((x) => x.deleteUUID(typeMoq.It.isAny()), typeMoq.Times.once());
    });
});
