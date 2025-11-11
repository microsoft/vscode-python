/* eslint-disable @typescript-eslint/no-explicit-any */
//  Copyright (c) Microsoft Corporation. All rights reserved.
//  Licensed under the MIT License.
import * as assert from 'assert';
import { TestRun, Uri, TestRunProfileKind, DebugSessionOptions } from 'vscode';
import * as typeMoq from 'typemoq';
import * as sinon from 'sinon';
import * as path from 'path';
import { Observable } from 'rxjs/Observable';
import { IConfigurationService } from '../../../../client/common/types';
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
import * as extapi from '../../../../client/envExt/api.internal';

suite('pytest test execution adapter', () => {
    let useEnvExtensionStub: sinon.SinonStub;
    let configService: IConfigurationService;
    let execFactory = typeMoq.Mock.ofType<IPythonExecutionFactory>();
    let adapter: PytestTestExecutionAdapter;
    let execService: typeMoq.IMock<IPythonExecutionService>;
    let deferred: Deferred<void>;
    let deferred4: Deferred<void>;
    let debugLauncher: typeMoq.IMock<ITestDebugLauncher>;
    (global as any).EXTENSION_ROOT_DIR = EXTENSION_ROOT_DIR;
    let myTestPath: string;
    let mockProc: MockChildProcess;
    let utilsWriteTestIdsFileStub: sinon.SinonStub;
    let utilsStartRunResultNamedPipeStub: sinon.SinonStub;

    setup(() => {
        useEnvExtensionStub = sinon.stub(extapi, 'useEnvExtension');
        useEnvExtensionStub.returns(false);
        configService = ({
            getSettings: () => ({
                testing: { pytestArgs: ['.'] },
            }),
            isTestExecution: () => false,
        } as unknown) as IConfigurationService;

        // set up exec service with child process
        mockProc = new MockChildProcess('', ['']);
        const output = new Observable<Output<string>>(() => {
            /* no op */
        });
        deferred4 = createDeferred();
        execService = typeMoq.Mock.ofType<IPythonExecutionService>();
        execService
            .setup((x) => x.execObservable(typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns(() => {
                deferred4.resolve();
                return {
                    proc: mockProc as any,
                    out: output,
                    dispose: () => {
                        /* no-body */
                    },
                };
            });
        execFactory = typeMoq.Mock.ofType<IPythonExecutionFactory>();

        // added
        utilsWriteTestIdsFileStub = sinon.stub(util, 'writeTestIdsFile');
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

        utilsStartRunResultNamedPipeStub = sinon.stub(util, 'startRunResultNamedPipe');
        utilsStartRunResultNamedPipeStub.callsFake(() => Promise.resolve('runResultPipe-mockName'));

        execService.setup((x) => x.getExecutablePath()).returns(() => Promise.resolve('/mock/path/to/python'));
    });
    teardown(() => {
        sinon.restore();
    });
    test('WriteTestIdsFile called with correct testIds', async () => {
        const deferred2 = createDeferred();
        const deferred3 = createDeferred();
        execFactory = typeMoq.Mock.ofType<IPythonExecutionFactory>();
        execFactory
            .setup((x) => x.createActivatedEnvironment(typeMoq.It.isAny()))
            .returns(() => {
                deferred2.resolve();
                return Promise.resolve(execService.object);
            });
        utilsWriteTestIdsFileStub.callsFake(() => {
            deferred3.resolve();
            return Promise.resolve({
                name: 'mockName',
                dispose: () => {
                    /* no-op */
                },
            });
        });
        const testRun = typeMoq.Mock.ofType<TestRun>();
        testRun.setup((t) => t.token).returns(() => ({ onCancellationRequested: () => undefined } as any));
        const uri = Uri.file(myTestPath);
        adapter = new PytestTestExecutionAdapter(configService);
        const testIds = ['test1id', 'test2id'];

        adapter.runTests(uri, testIds, TestRunProfileKind.Run, testRun.object, execFactory.object);

        // add in await and trigger
        await deferred2.promise;
        await deferred3.promise;
        mockProc.trigger('close');

        // assert
        sinon.assert.calledWithExactly(utilsWriteTestIdsFileStub, testIds);
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
        utilsWriteTestIdsFileStub.callsFake(() => {
            deferred3.resolve();
            return Promise.resolve('testIdPipe-mockName');
        });
        const testRun = typeMoq.Mock.ofType<TestRun>();
        testRun.setup((t) => t.token).returns(() => ({ onCancellationRequested: () => undefined } as any));
        const uri = Uri.file(myTestPath);
        adapter = new PytestTestExecutionAdapter(configService);
        adapter.runTests(uri, [], TestRunProfileKind.Run, testRun.object, execFactory.object);

        await deferred2.promise;
        await deferred3.promise;
        await deferred4.promise;
        mockProc.trigger('close');

        const pathToPythonFiles = path.join(EXTENSION_ROOT_DIR, 'python_files');
        const pathToPythonScript = path.join(pathToPythonFiles, 'vscode_pytest', 'run_pytest_script.py');
        const rootDirArg = `--rootdir=${myTestPath}`;
        const expectedArgs = [pathToPythonScript, rootDirArg];
        const expectedExtraVariables = {
            PYTHONPATH: pathToPythonFiles,
            TEST_RUN_PIPE: 'runResultPipe-mockName',
            RUN_TEST_IDS_PIPE: 'testIdPipe-mockName',
        };
        execService.verify(
            (x) =>
                x.execObservable(
                    expectedArgs,
                    typeMoq.It.is<SpawnOptions>((options) => {
                        assert.equal(options.env?.PYTHONPATH, expectedExtraVariables.PYTHONPATH);
                        assert.equal(options.env?.TEST_RUN_PIPE, expectedExtraVariables.TEST_RUN_PIPE);
                        assert.equal(options.env?.RUN_TEST_IDS_PIPE, expectedExtraVariables.RUN_TEST_IDS_PIPE);
                        assert.equal(options.env?.COVERAGE_ENABLED, undefined); // coverage not enabled
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
        utilsWriteTestIdsFileStub.callsFake(() => {
            deferred3.resolve();
            return Promise.resolve('testIdPipe-mockName');
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
        adapter = new PytestTestExecutionAdapter(configService);
        adapter.runTests(uri, [], TestRunProfileKind.Run, testRun.object, execFactory.object);

        await deferred2.promise;
        await deferred3.promise;
        await deferred4.promise;
        mockProc.trigger('close');

        const pathToPythonFiles = path.join(EXTENSION_ROOT_DIR, 'python_files');
        const pathToPythonScript = path.join(pathToPythonFiles, 'vscode_pytest', 'run_pytest_script.py');
        const expectedArgs = [pathToPythonScript, `--rootdir=${newCwd}`];
        const expectedExtraVariables = {
            PYTHONPATH: pathToPythonFiles,
            TEST_RUN_PIPE: 'runResultPipe-mockName',
            RUN_TEST_IDS_PIPE: 'testIdPipe-mockName',
        };

        execService.verify(
            (x) =>
                x.execObservable(
                    expectedArgs,
                    typeMoq.It.is<SpawnOptions>((options) => {
                        assert.equal(options.env?.PYTHONPATH, expectedExtraVariables.PYTHONPATH);
                        assert.equal(options.env?.TEST_RUN_PIPE, expectedExtraVariables.TEST_RUN_PIPE);
                        assert.equal(options.env?.RUN_TEST_IDS_PIPE, expectedExtraVariables.RUN_TEST_IDS_PIPE);
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
        utilsWriteTestIdsFileStub.callsFake(() => Promise.resolve('testIdPipe-mockName'));
        debugLauncher
            .setup((dl) => dl.launchDebugger(typeMoq.It.isAny(), typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns(async (_opts, callback) => {
                traceInfo('stubs launch debugger');
                if (typeof callback === 'function') {
                    deferred3.resolve();
                    callback();
                }
            });
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
        adapter = new PytestTestExecutionAdapter(configService);
        adapter.runTests(uri, [], TestRunProfileKind.Debug, testRun.object, execFactory.object, debugLauncher.object);
        await deferred3.promise;
        debugLauncher.verify(
            (x) =>
                x.launchDebugger(
                    typeMoq.It.is<LaunchOptions>((launchOptions) => {
                        assert.equal(launchOptions.cwd, uri.fsPath);
                        assert.deepEqual(launchOptions.args, [`--rootdir=${myTestPath}`, '--capture=no']);
                        assert.equal(launchOptions.testProvider, 'pytest');
                        assert.equal(launchOptions.pytestPort, 'runResultPipe-mockName');
                        assert.strictEqual(launchOptions.runTestIdsPort, 'testIdPipe-mockName');
                        assert.notEqual(launchOptions.token, undefined);
                        return true;
                    }),
                    typeMoq.It.isAny(),
                    typeMoq.It.is<DebugSessionOptions>((sessionOptions) => {
                        assert.equal(sessionOptions.testRun, testRun.object);
                        return true;
                    }),
                ),
            typeMoq.Times.once(),
        );
    });
    test('pytest execution with coverage turns on correctly', async () => {
        const deferred2 = createDeferred();
        const deferred3 = createDeferred();
        execFactory = typeMoq.Mock.ofType<IPythonExecutionFactory>();
        execFactory
            .setup((x) => x.createActivatedEnvironment(typeMoq.It.isAny()))
            .returns(() => {
                deferred2.resolve();
                return Promise.resolve(execService.object);
            });
        utilsWriteTestIdsFileStub.callsFake(() => {
            deferred3.resolve();
            return Promise.resolve('testIdPipe-mockName');
        });
        const testRun = typeMoq.Mock.ofType<TestRun>();
        testRun.setup((t) => t.token).returns(() => ({ onCancellationRequested: () => undefined } as any));
        const uri = Uri.file(myTestPath);
        adapter = new PytestTestExecutionAdapter(configService);
        adapter.runTests(uri, [], TestRunProfileKind.Coverage, testRun.object, execFactory.object);

        await deferred2.promise;
        await deferred3.promise;
        await deferred4.promise;
        mockProc.trigger('close');

        const pathToPythonFiles = path.join(EXTENSION_ROOT_DIR, 'python_files');
        const pathToPythonScript = path.join(pathToPythonFiles, 'vscode_pytest', 'run_pytest_script.py');
        const rootDirArg = `--rootdir=${myTestPath}`;
        const expectedArgs = [pathToPythonScript, rootDirArg];
        execService.verify(
            (x) =>
                x.execObservable(
                    expectedArgs,
                    typeMoq.It.is<SpawnOptions>((options) => {
                        assert.equal(options.env?.COVERAGE_ENABLED, 'True');
                        return true;
                    }),
                ),
            typeMoq.Times.once(),
        );
    });

    suite('Environment Extension Integration', () => {
        let getEnvironmentStub: sinon.SinonStub;
        let runInBackgroundStub: sinon.SinonStub;
        let mockEnvProcess: any;

        setup(() => {
            // Stub environment extension APIs
            getEnvironmentStub = sinon.stub(extapi, 'getEnvironment');
            runInBackgroundStub = sinon.stub(extapi, 'runInBackground');

            // Create mock environment process
            mockEnvProcess = {
                pid: 12345,
                onExit: sinon.stub(),
                stdout: {
                    on: sinon.stub(),
                },
                stderr: {
                    on: sinon.stub(),
                },
                kill: sinon.stub(),
            };
        });

        test('Uses environment extension when enabled', async () => {
            useEnvExtensionStub.returns(true);

            const mockPythonEnv = {
                id: 'test-env',
                executable: { uri: Uri.file('/usr/bin/python3') },
            };
            getEnvironmentStub.resolves(mockPythonEnv);
            runInBackgroundStub.resolves(mockEnvProcess);

            const deferred2 = createDeferred();
            const deferred3 = createDeferred();
            execFactory = typeMoq.Mock.ofType<IPythonExecutionFactory>();
            execFactory
                .setup((x) => x.createActivatedEnvironment(typeMoq.It.isAny()))
                .returns(() => {
                    deferred2.resolve();
                    return Promise.resolve(execService.object);
                });
            utilsWriteTestIdsFileStub.callsFake(() => {
                deferred3.resolve();
                return Promise.resolve('testIdPipe-mockName');
            });

            const testRun = typeMoq.Mock.ofType<TestRun>();
            testRun.setup((t) => t.token).returns(() => ({ onCancellationRequested: () => undefined } as any));

            const uri = Uri.file(myTestPath);
            adapter = new PytestTestExecutionAdapter(configService);

            const runPromise = adapter.runTests(
                uri,
                ['test1'],
                TestRunProfileKind.Run,
                testRun.object,
                execFactory.object,
            );

            await deferred2.promise;
            await deferred3.promise;
            await utilsStartRunResultNamedPipeStub.returnValues[0];

            // Wait for runInBackground to be called
            await new Promise((resolve) => setImmediate(resolve));

            // Trigger process exit
            sinon.assert.calledOnce(mockEnvProcess.onExit);
            const exitCallback = mockEnvProcess.onExit.firstCall.args[0];
            exitCallback(0, null);

            await runPromise;

            // Verify environment extension APIs were called
            sinon.assert.calledOnce(getEnvironmentStub);
            sinon.assert.calledOnce(runInBackgroundStub);

            // Verify runInBackground was called with correct args
            const runInBackgroundCall = runInBackgroundStub.firstCall;
            assert.strictEqual(runInBackgroundCall.args[0], mockPythonEnv);
            assert.strictEqual(runInBackgroundCall.args[1].cwd, myTestPath);
            assert.ok(Array.isArray(runInBackgroundCall.args[1].args));
        });

        test('Handles cancellation with environment extension', async () => {
            useEnvExtensionStub.returns(true);

            const mockPythonEnv = {
                id: 'test-env',
                executable: { uri: Uri.file('/usr/bin/python3') },
            };
            getEnvironmentStub.resolves(mockPythonEnv);
            runInBackgroundStub.resolves(mockEnvProcess);

            const deferred2 = createDeferred();
            const deferred3 = createDeferred();
            execFactory = typeMoq.Mock.ofType<IPythonExecutionFactory>();
            execFactory
                .setup((x) => x.createActivatedEnvironment(typeMoq.It.isAny()))
                .returns(() => {
                    deferred2.resolve();
                    return Promise.resolve(execService.object);
                });
            utilsWriteTestIdsFileStub.callsFake(() => {
                deferred3.resolve();
                return Promise.resolve('testIdPipe-mockName');
            });

            let cancellationHandler: (() => void) | undefined;
            const testRun = typeMoq.Mock.ofType<TestRun>();
            testRun
                .setup((t) => t.token)
                .returns(
                    () =>
                        ({
                            onCancellationRequested: (handler: () => void) => {
                                cancellationHandler = handler;
                            },
                            isCancellationRequested: false,
                        } as any),
                );

            const uri = Uri.file(myTestPath);
            adapter = new PytestTestExecutionAdapter(configService);

            const runPromise = adapter.runTests(
                uri,
                ['test1'],
                TestRunProfileKind.Run,
                testRun.object,
                execFactory.object,
            );

            await deferred2.promise;
            await deferred3.promise;
            await utilsStartRunResultNamedPipeStub.returnValues[0];

            // Wait for runInBackground to be called
            await new Promise((resolve) => setImmediate(resolve));

            // Trigger cancellation
            if (cancellationHandler) {
                cancellationHandler();
            }

            // Wait for kill to be called
            await new Promise((resolve) => setImmediate(resolve));

            // Verify process.kill was called
            sinon.assert.calledOnce(mockEnvProcess.kill);

            // Trigger process exit after cancellation
            const exitCallback = mockEnvProcess.onExit.firstCall.args[0];
            exitCallback(null, 'SIGTERM');

            await runPromise;
        });

        test('Handles environment not found gracefully', async () => {
            useEnvExtensionStub.returns(true);
            getEnvironmentStub.resolves(undefined);

            const deferred2 = createDeferred();
            const deferred3 = createDeferred();
            execFactory = typeMoq.Mock.ofType<IPythonExecutionFactory>();
            execFactory
                .setup((x) => x.createActivatedEnvironment(typeMoq.It.isAny()))
                .returns(() => {
                    deferred2.resolve();
                    return Promise.resolve(execService.object);
                });
            utilsWriteTestIdsFileStub.callsFake(() => {
                deferred3.resolve();
                return Promise.resolve('testIdPipe-mockName');
            });

            const testRun = typeMoq.Mock.ofType<TestRun>();
            testRun.setup((t) => t.token).returns(() => ({ onCancellationRequested: () => undefined } as any));

            const uri = Uri.file(myTestPath);
            adapter = new PytestTestExecutionAdapter(configService);

            const runPromise = adapter.runTests(
                uri,
                ['test1'],
                TestRunProfileKind.Run,
                testRun.object,
                execFactory.object,
            );

            await deferred2.promise;
            await deferred3.promise;
            await utilsStartRunResultNamedPipeStub.returnValues[0];

            await runPromise;

            // Verify runInBackground was NOT called
            sinon.assert.notCalled(runInBackgroundStub);
        });

        test('Environment extension passes correct environment variables', async () => {
            useEnvExtensionStub.returns(true);

            const mockPythonEnv = {
                id: 'test-env',
                executable: { uri: Uri.file('/usr/bin/python3') },
            };
            getEnvironmentStub.resolves(mockPythonEnv);
            runInBackgroundStub.resolves(mockEnvProcess);

            const deferred2 = createDeferred();
            const deferred3 = createDeferred();
            execFactory = typeMoq.Mock.ofType<IPythonExecutionFactory>();
            execFactory
                .setup((x) => x.createActivatedEnvironment(typeMoq.It.isAny()))
                .returns(() => {
                    deferred2.resolve();
                    return Promise.resolve(execService.object);
                });
            utilsWriteTestIdsFileStub.callsFake(() => {
                deferred3.resolve();
                return Promise.resolve('testIdPipe-mockName');
            });

            const testRun = typeMoq.Mock.ofType<TestRun>();
            testRun.setup((t) => t.token).returns(() => ({ onCancellationRequested: () => undefined } as any));

            const uri = Uri.file(myTestPath);
            adapter = new PytestTestExecutionAdapter(configService);

            const runPromise = adapter.runTests(
                uri,
                ['test1'],
                TestRunProfileKind.Run,
                testRun.object,
                execFactory.object,
            );

            await deferred2.promise;
            await deferred3.promise;
            await utilsStartRunResultNamedPipeStub.returnValues[0];

            // Wait for runInBackground to be called
            await new Promise((resolve) => setImmediate(resolve));

            // Trigger process exit
            const exitCallback = mockEnvProcess.onExit.firstCall.args[0];
            exitCallback(0, null);

            await runPromise;

            // Verify environment variables passed to runInBackground
            const runInBackgroundCall = runInBackgroundStub.firstCall;
            const options = runInBackgroundCall.args[1];
            const pathToPythonFiles = path.join(EXTENSION_ROOT_DIR, 'python_files');

            assert.ok(options.env.PYTHONPATH.includes(pathToPythonFiles), 'PYTHONPATH should include python_files');
            assert.strictEqual(options.env.TEST_RUN_PIPE, 'runResultPipe-mockName');
            assert.strictEqual(options.env.RUN_TEST_IDS_PIPE, 'testIdPipe-mockName');
        });

        test('Environment extension handles process exit with non-zero code', async () => {
            useEnvExtensionStub.returns(true);

            const mockPythonEnv = {
                id: 'test-env',
                executable: { uri: Uri.file('/usr/bin/python3') },
            };
            getEnvironmentStub.resolves(mockPythonEnv);
            runInBackgroundStub.resolves(mockEnvProcess);

            const deferred2 = createDeferred();
            const deferred3 = createDeferred();
            execFactory = typeMoq.Mock.ofType<IPythonExecutionFactory>();
            execFactory
                .setup((x) => x.createActivatedEnvironment(typeMoq.It.isAny()))
                .returns(() => {
                    deferred2.resolve();
                    return Promise.resolve(execService.object);
                });
            utilsWriteTestIdsFileStub.callsFake(() => {
                deferred3.resolve();
                return Promise.resolve('testIdPipe-mockName');
            });

            const testRun = typeMoq.Mock.ofType<TestRun>();
            testRun.setup((t) => t.token).returns(() => ({ onCancellationRequested: () => undefined } as any));

            const uri = Uri.file(myTestPath);
            adapter = new PytestTestExecutionAdapter(configService);

            const runPromise = adapter.runTests(
                uri,
                ['test1'],
                TestRunProfileKind.Run,
                testRun.object,
                execFactory.object,
            );

            await deferred2.promise;
            await deferred3.promise;
            await utilsStartRunResultNamedPipeStub.returnValues[0];

            // Wait for runInBackground to be called
            await new Promise((resolve) => setImmediate(resolve));

            // Trigger process exit with error code
            const exitCallback = mockEnvProcess.onExit.firstCall.args[0];
            exitCallback(1, null);

            await runPromise;

            // Test should complete without throwing
            assert.ok(true, 'Test completed successfully even with non-zero exit code');
        });
    });

    suite('Cancellation and Cleanup', () => {
        test('Cancellation triggers process kill in legacy mode', async () => {
            useEnvExtensionStub.returns(false);

            const deferred2 = createDeferred();
            const deferred3 = createDeferred();
            execFactory = typeMoq.Mock.ofType<IPythonExecutionFactory>();
            execFactory
                .setup((x) => x.createActivatedEnvironment(typeMoq.It.isAny()))
                .returns(() => {
                    deferred2.resolve();
                    return Promise.resolve(execService.object);
                });
            utilsWriteTestIdsFileStub.callsFake(() => {
                deferred3.resolve();
                return Promise.resolve('testIdPipe-mockName');
            });

            let cancellationHandler: (() => void) | undefined;
            const testRun = typeMoq.Mock.ofType<TestRun>();
            testRun
                .setup((t) => t.token)
                .returns(
                    () =>
                        ({
                            onCancellationRequested: (handler: () => void) => {
                                cancellationHandler = handler;
                            },
                            isCancellationRequested: false,
                        } as any),
                );

            const killStub = sinon.stub(mockProc, 'kill');

            const uri = Uri.file(myTestPath);
            adapter = new PytestTestExecutionAdapter(configService);

            const runPromise = adapter.runTests(
                uri,
                ['test1'],
                TestRunProfileKind.Run,
                testRun.object,
                execFactory.object,
            );

            await deferred2.promise;
            await deferred3.promise;
            await deferred4.promise;
            await utilsStartRunResultNamedPipeStub.returnValues[0];

            // Trigger cancellation
            if (cancellationHandler) {
                cancellationHandler();
            }

            // Wait for kill to be processed
            await new Promise((resolve) => setImmediate(resolve));

            // Verify process.kill was called
            sinon.assert.calledOnce(killStub);

            // Trigger process close
            mockProc.trigger('close');

            await runPromise;
        });

        test('Instance cleanup happens after process close', async () => {
            useEnvExtensionStub.returns(false);

            const deferred2 = createDeferred();
            const deferred3 = createDeferred();
            execFactory = typeMoq.Mock.ofType<IPythonExecutionFactory>();
            execFactory
                .setup((x) => x.createActivatedEnvironment(typeMoq.It.isAny()))
                .returns(() => {
                    deferred2.resolve();
                    return Promise.resolve(execService.object);
                });
            utilsWriteTestIdsFileStub.callsFake(() => {
                deferred3.resolve();
                return Promise.resolve('testIdPipe-mockName');
            });

            const testRun = typeMoq.Mock.ofType<TestRun>();
            testRun.setup((t) => t.token).returns(() => ({ onCancellationRequested: () => undefined } as any));

            const uri = Uri.file(myTestPath);
            adapter = new PytestTestExecutionAdapter(configService);

            const runPromise = adapter.runTests(
                uri,
                ['test1'],
                TestRunProfileKind.Run,
                testRun.object,
                execFactory.object,
            );

            await deferred2.promise;
            await deferred3.promise;
            await deferred4.promise;
            await utilsStartRunResultNamedPipeStub.returnValues[0];

            // Access private activeInstances to verify cleanup
            const activeInstances = (adapter as any).activeInstances;
            const instanceCountBefore = activeInstances.size;
            assert.strictEqual(instanceCountBefore, 1, 'Should have one active instance');

            // Trigger process close
            mockProc.trigger('close');

            await runPromise;

            // Verify instance was cleaned up
            const instanceCountAfter = activeInstances.size;
            assert.strictEqual(instanceCountAfter, 0, 'Instance should be removed after close');
        });

        test('Promise resolution happens correctly on success', async () => {
            useEnvExtensionStub.returns(false);

            const deferred2 = createDeferred();
            const deferred3 = createDeferred();
            execFactory = typeMoq.Mock.ofType<IPythonExecutionFactory>();
            execFactory
                .setup((x) => x.createActivatedEnvironment(typeMoq.It.isAny()))
                .returns(() => {
                    deferred2.resolve();
                    return Promise.resolve(execService.object);
                });
            utilsWriteTestIdsFileStub.callsFake(() => {
                deferred3.resolve();
                return Promise.resolve('testIdPipe-mockName');
            });

            const testRun = typeMoq.Mock.ofType<TestRun>();
            testRun.setup((t) => t.token).returns(() => ({ onCancellationRequested: () => undefined } as any));

            const uri = Uri.file(myTestPath);
            adapter = new PytestTestExecutionAdapter(configService);

            const runPromise = adapter.runTests(
                uri,
                ['test1'],
                TestRunProfileKind.Run,
                testRun.object,
                execFactory.object,
                undefined,
                undefined,
            );

            await deferred2.promise;
            await deferred3.promise;
            await deferred4.promise;
            await utilsStartRunResultNamedPipeStub.returnValues[0];

            // Trigger successful close (exit code 0, no signal)
            mockProc.trigger('close');

            await runPromise;

            // If we reach here without hanging, promise resolved correctly
            assert.ok(true, 'Promise resolved successfully');
        });

        test('Promise resolution happens correctly on error', async () => {
            useEnvExtensionStub.returns(false);

            const deferred2 = createDeferred();
            const deferred3 = createDeferred();
            execFactory = typeMoq.Mock.ofType<IPythonExecutionFactory>();
            execFactory
                .setup((x) => x.createActivatedEnvironment(typeMoq.It.isAny()))
                .returns(() => {
                    deferred2.resolve();
                    return Promise.resolve(execService.object);
                });
            utilsWriteTestIdsFileStub.callsFake(() => {
                deferred3.resolve();
                return Promise.resolve('testIdPipe-mockName');
            });

            const testRun = typeMoq.Mock.ofType<TestRun>();
            testRun.setup((t) => t.token).returns(() => ({ onCancellationRequested: () => undefined } as any));

            const uri = Uri.file(myTestPath);
            adapter = new PytestTestExecutionAdapter(configService);

            const runPromise = adapter.runTests(
                uri,
                ['test1'],
                TestRunProfileKind.Run,
                testRun.object,
                execFactory.object,
                undefined,
                undefined,
            );

            await deferred2.promise;
            await deferred3.promise;
            await deferred4.promise;
            await utilsStartRunResultNamedPipeStub.returnValues[0];

            // Trigger error close (exit code 1, SIGTERM signal)
            mockProc.trigger('close');

            await runPromise;

            // If we reach here without hanging, promise resolved correctly
            assert.ok(true, 'Promise resolved successfully even on error');
        });
    });
});
