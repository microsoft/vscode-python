/* eslint-disable @typescript-eslint/no-explicit-any */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as typeMoq from 'typemoq';
import { TestRun, Uri } from 'vscode';
import { ChildProcess } from 'child_process';
import { PytestSubprocessInstance } from '../../../../client/testing/testController/pytest/pytestSubprocessInstance';
import * as utils from '../../../../client/testing/testController/common/utils';
import { ExecutionTestPayload } from '../../../../client/testing/testController/common/types';

suite('PytestSubprocessInstance Unit Tests', () => {
    let testRun: typeMoq.IMock<TestRun>;
    let uri: Uri;
    let writeTestIdsFileStub: sinon.SinonStub;

    setup(() => {
        testRun = typeMoq.Mock.ofType<TestRun>();
        uri = Uri.file('/test/path');
        writeTestIdsFileStub = sinon.stub(utils, 'writeTestIdsFile');
    });

    teardown(() => {
        sinon.restore();
    });

    suite('Initialization', () => {
        test('Constructor initializes properties correctly', () => {
            const testIds = ['test1', 'test2'];
            const resultPipeName = 'test-pipe';

            const instance = new PytestSubprocessInstance(testRun.object, false, uri, resultPipeName, testIds);

            assert.strictEqual(instance.testRun, testRun.object);
            assert.strictEqual(instance.debugBool, false);
            assert.strictEqual(instance.workspaceUri, uri);
            assert.strictEqual(instance.resultPipeName, resultPipeName);
            assert.deepStrictEqual(instance.testIds, testIds);
            assert.ok(instance.deferred);
            assert.strictEqual(instance.cancellationToken, undefined);
            assert.strictEqual(instance.process, undefined);
            assert.strictEqual(instance.testIdsFileName, undefined);
        });

        test('Initialize creates test IDs file', async () => {
            const testIds = ['test1', 'test2'];
            const expectedFileName = '/tmp/test-ids-file';
            writeTestIdsFileStub.resolves(expectedFileName);

            const instance = new PytestSubprocessInstance(testRun.object, false, uri, 'pipe', testIds);
            await instance.initialize();

            assert.strictEqual(instance.testIdsFileName, expectedFileName);
            sinon.assert.calledOnceWithExactly(writeTestIdsFileStub, testIds);
        });

        test('Initialize handles empty test IDs', async () => {
            const testIds: string[] = [];
            const expectedFileName = '/tmp/empty-ids';
            writeTestIdsFileStub.resolves(expectedFileName);

            const instance = new PytestSubprocessInstance(testRun.object, false, uri, 'pipe', testIds);
            await instance.initialize();

            assert.strictEqual(instance.testIdsFileName, expectedFileName);
            sinon.assert.calledOnceWithExactly(writeTestIdsFileStub, testIds);
        });

        test('Initialize propagates errors from writeTestIdsFile', async () => {
            const error = new Error('Failed to write file');
            writeTestIdsFileStub.rejects(error);

            const instance = new PytestSubprocessInstance(testRun.object, false, uri, 'pipe', ['test1']);

            await assert.rejects(async () => {
                await instance.initialize();
            }, error);
        });
    });

    suite('Process Management', () => {
        test('setProcess stores process reference', () => {
            const mockProcess = { pid: 1234 } as ChildProcess;
            const instance = new PytestSubprocessInstance(testRun.object, false, uri, 'pipe', []);

            instance.setProcess(mockProcess);

            assert.strictEqual(instance.process, mockProcess);
        });

        test('setProcess can be called multiple times', () => {
            const mockProcess1 = { pid: 1234 } as ChildProcess;
            const mockProcess2 = { pid: 5678 } as ChildProcess;
            const instance = new PytestSubprocessInstance(testRun.object, false, uri, 'pipe', []);

            instance.setProcess(mockProcess1);
            assert.strictEqual(instance.process, mockProcess1);

            instance.setProcess(mockProcess2);
            assert.strictEqual(instance.process, mockProcess2);
        });
    });

    suite('Cancellation Handling', () => {
        test('setCancellationToken stores token reference', () => {
            const token = { cancelled: false };
            const instance = new PytestSubprocessInstance(testRun.object, false, uri, 'pipe', []);

            instance.setCancellationToken(token);

            assert.strictEqual(instance.cancellationToken, token);
        });

        test('isCancelled returns false when no token set', () => {
            const instance = new PytestSubprocessInstance(testRun.object, false, uri, 'pipe', []);

            assert.strictEqual(instance.isCancelled(), false);
        });

        test('isCancelled returns false when token is not cancelled', () => {
            const token = { cancelled: false };
            const instance = new PytestSubprocessInstance(testRun.object, false, uri, 'pipe', []);

            instance.setCancellationToken(token);

            assert.strictEqual(instance.isCancelled(), false);
        });

        test('isCancelled returns true when token is cancelled', () => {
            const token = { cancelled: true };
            const instance = new PytestSubprocessInstance(testRun.object, false, uri, 'pipe', []);

            instance.setCancellationToken(token);

            assert.strictEqual(instance.isCancelled(), true);
        });

        test('isCancelled reflects token state changes', () => {
            const token = { cancelled: false };
            const instance = new PytestSubprocessInstance(testRun.object, false, uri, 'pipe', []);

            instance.setCancellationToken(token);
            assert.strictEqual(instance.isCancelled(), false);

            token.cancelled = true;
            assert.strictEqual(instance.isCancelled(), true);

            token.cancelled = false;
            assert.strictEqual(instance.isCancelled(), false);
        });

        test('handleDataReceivedEvent skips processing when cancelled', () => {
            const token = { cancelled: true };
            const instance = new PytestSubprocessInstance(testRun.object, false, uri, 'pipe', []);
            instance.setCancellationToken(token);

            const successPayload: ExecutionTestPayload = {
                status: 'success',
                cwd: '/test',
                result: {},
                error: '',
            };

            instance.handleDataReceivedEvent(successPayload);

            // Deferred should not resolve when cancelled
            let promiseResolved = false;
            instance.getExecutionPromise().then(() => {
                promiseResolved = true;
            });

            // Use setImmediate to allow promise to potentially resolve
            return new Promise<void>((resolve) => {
                setImmediate(() => {
                    assert.strictEqual(promiseResolved, false, 'Promise should not resolve when cancelled');
                    resolve();
                });
            });
        });
    });

    suite('Data Handling', () => {
        test('handleDataReceivedEvent resolves deferred on success status', async () => {
            const instance = new PytestSubprocessInstance(testRun.object, false, uri, 'pipe', []);

            const successPayload: ExecutionTestPayload = {
                status: 'success',
                cwd: '/test',
                result: {
                    testId1: {
                        test: 'test1',
                        outcome: 'success',
                    },
                },
                error: '',
            };

            instance.handleDataReceivedEvent(successPayload);

            const result = await instance.getExecutionPromise();
            assert.deepStrictEqual(result, successPayload);
        });

        test('handleDataReceivedEvent resolves deferred on error status', async () => {
            const instance = new PytestSubprocessInstance(testRun.object, false, uri, 'pipe', []);

            const errorPayload: ExecutionTestPayload = {
                status: 'error',
                cwd: '/test',
                error: 'Test error',
            };

            instance.handleDataReceivedEvent(errorPayload);

            const result = await instance.getExecutionPromise();
            assert.deepStrictEqual(result, errorPayload);
        });

        test('handleDataReceivedEvent does not resolve on unknown status', () => {
            const instance = new PytestSubprocessInstance(testRun.object, false, uri, 'pipe', []);

            const unknownPayload = {
                status: 'unknown',
                cwd: '/test',
                error: '',
            } as any;

            instance.handleDataReceivedEvent(unknownPayload);

            let promiseResolved = false;
            instance.getExecutionPromise().then(() => {
                promiseResolved = true;
            });

            return new Promise<void>((resolve) => {
                setImmediate(() => {
                    assert.strictEqual(promiseResolved, false, 'Promise should not resolve on unknown status');
                    resolve();
                });
            });
        });

        test('getExecutionPromise returns the same promise on multiple calls', () => {
            const instance = new PytestSubprocessInstance(testRun.object, false, uri, 'pipe', []);

            const promise1 = instance.getExecutionPromise();
            const promise2 = instance.getExecutionPromise();

            assert.strictEqual(promise1, promise2);
        });

        test('handleDataReceivedEvent resolves promise only once', async () => {
            const instance = new PytestSubprocessInstance(testRun.object, false, uri, 'pipe', []);

            const successPayload1: ExecutionTestPayload = {
                status: 'success',
                cwd: '/test',
                result: {
                    testId1: {
                        test: 'test1',
                        outcome: 'success',
                    },
                },
                error: '',
            };

            const successPayload2: ExecutionTestPayload = {
                status: 'success',
                cwd: '/test',
                result: {
                    testId2: {
                        test: 'test2',
                        outcome: 'success',
                    },
                },
                error: '',
            };

            instance.handleDataReceivedEvent(successPayload1);
            instance.handleDataReceivedEvent(successPayload2);

            const result = await instance.getExecutionPromise();
            // Should resolve with first payload
            assert.deepStrictEqual(result, successPayload1);
        });
    });

    suite('Cleanup and Disposal', () => {
        test('dispose kills process if running', () => {
            const mockProcess = ({
                pid: 1234,
                kill: sinon.stub(),
            } as unknown) as ChildProcess;

            const instance = new PytestSubprocessInstance(testRun.object, false, uri, 'pipe', []);
            instance.setProcess(mockProcess);

            instance.dispose();

            sinon.assert.calledOnce(mockProcess.kill as sinon.SinonStub);
        });

        test('dispose completes successfully when test IDs file exists', async () => {
            const testIdsFileName = '/tmp/nonexistent-test-ids';
            writeTestIdsFileStub.resolves(testIdsFileName);

            const instance = new PytestSubprocessInstance(testRun.object, false, uri, 'pipe', ['test1']);
            await instance.initialize();

            // Dispose should not throw even if file doesn't exist
            assert.doesNotThrow(() => {
                instance.dispose();
            });
        });

        test('dispose handles missing process gracefully', () => {
            const instance = new PytestSubprocessInstance(testRun.object, false, uri, 'pipe', []);

            assert.doesNotThrow(() => {
                instance.dispose();
            });
        });

        test('dispose handles missing test IDs file gracefully', () => {
            const instance = new PytestSubprocessInstance(testRun.object, false, uri, 'pipe', []);

            assert.doesNotThrow(() => {
                instance.dispose();
            });
        });

        test('dispose handles process kill error gracefully', () => {
            const mockProcess = ({
                pid: 1234,
                kill: sinon.stub().throws(new Error('Kill failed')),
            } as unknown) as ChildProcess;

            const instance = new PytestSubprocessInstance(testRun.object, false, uri, 'pipe', []);
            instance.setProcess(mockProcess);

            assert.doesNotThrow(() => {
                instance.dispose();
            });
        });

        test('dispose performs cleanup operations', async () => {
            const testIdsFileName = '/tmp/test-ids';
            writeTestIdsFileStub.resolves(testIdsFileName);

            const mockProcess = ({
                pid: 1234,
                kill: sinon.stub(),
            } as unknown) as ChildProcess;

            const instance = new PytestSubprocessInstance(testRun.object, false, uri, 'pipe', ['test1']);
            await instance.initialize();
            instance.setProcess(mockProcess);

            instance.dispose();

            // Verify process was killed
            sinon.assert.calledOnce(mockProcess.kill as sinon.SinonStub);

            // Verify testIdsFileName is set (file cleanup will be attempted)
            assert.strictEqual(instance.testIdsFileName, testIdsFileName);
        });
    });

    suite('Integration Scenarios', () => {
        test('Full lifecycle: initialize, set process, receive data, dispose', async () => {
            const testIds = ['test1', 'test2'];
            const testIdsFileName = '/tmp/test-ids';
            writeTestIdsFileStub.resolves(testIdsFileName);

            const mockProcess = ({
                pid: 1234,
                kill: sinon.stub(),
            } as unknown) as ChildProcess;

            const instance = new PytestSubprocessInstance(testRun.object, false, uri, 'pipe', testIds);

            // Initialize
            await instance.initialize();
            assert.strictEqual(instance.testIdsFileName, testIdsFileName);

            // Set process
            instance.setProcess(mockProcess);
            assert.strictEqual(instance.process, mockProcess);

            // Receive data
            const successPayload: ExecutionTestPayload = {
                status: 'success',
                cwd: '/test',
                result: {},
                error: '',
            };
            instance.handleDataReceivedEvent(successPayload);

            const result = await instance.getExecutionPromise();
            assert.deepStrictEqual(result, successPayload);

            // Dispose
            instance.dispose();
            sinon.assert.calledOnce(mockProcess.kill as sinon.SinonStub);
        });

        test('Cancellation during execution prevents data processing', async () => {
            const token = { cancelled: false };
            const instance = new PytestSubprocessInstance(testRun.object, false, uri, 'pipe', []);
            instance.setCancellationToken(token);

            const successPayload: ExecutionTestPayload = {
                status: 'success',
                cwd: '/test',
                result: {},
                error: '',
            };

            // Cancel before receiving data
            token.cancelled = true;
            instance.handleDataReceivedEvent(successPayload);

            let promiseResolved = false;
            instance.getExecutionPromise().then(() => {
                promiseResolved = true;
            });

            return new Promise<void>((resolve) => {
                setImmediate(() => {
                    assert.strictEqual(promiseResolved, false);
                    resolve();
                });
            });
        });

        test('Multiple instances can coexist independently', async () => {
            writeTestIdsFileStub.onCall(0).resolves('/tmp/ids1');
            writeTestIdsFileStub.onCall(1).resolves('/tmp/ids2');

            const instance1 = new PytestSubprocessInstance(testRun.object, false, uri, 'pipe1', ['test1']);
            const instance2 = new PytestSubprocessInstance(testRun.object, false, uri, 'pipe2', ['test2']);

            await instance1.initialize();
            await instance2.initialize();

            assert.strictEqual(instance1.testIdsFileName, '/tmp/ids1');
            assert.strictEqual(instance2.testIdsFileName, '/tmp/ids2');

            const payload1: ExecutionTestPayload = {
                status: 'success',
                cwd: '/test',
                result: {
                    testId1: {
                        test: 'test1',
                        outcome: 'success',
                    },
                },
                error: '',
            };

            const payload2: ExecutionTestPayload = {
                status: 'success',
                cwd: '/test',
                result: {
                    testId2: {
                        test: 'test2',
                        outcome: 'success',
                    },
                },
                error: '',
            };

            instance1.handleDataReceivedEvent(payload1);
            instance2.handleDataReceivedEvent(payload2);

            const [result1, result2] = await Promise.all([
                instance1.getExecutionPromise(),
                instance2.getExecutionPromise(),
            ]);

            assert.deepStrictEqual(result1, payload1);
            assert.deepStrictEqual(result2, payload2);
        });
    });

    suite('Debug Mode', () => {
        test('Debug mode flag is stored correctly', () => {
            const instanceDebug = new PytestSubprocessInstance(testRun.object, true, uri, 'pipe', []);
            const instanceNonDebug = new PytestSubprocessInstance(testRun.object, false, uri, 'pipe', []);

            assert.strictEqual(instanceDebug.debugBool, true);
            assert.strictEqual(instanceNonDebug.debugBool, false);
        });
    });

    suite('Edge Cases', () => {
        test('Dispose before initialize does not throw', () => {
            const instance = new PytestSubprocessInstance(testRun.object, false, uri, 'pipe', []);

            assert.doesNotThrow(() => {
                instance.dispose();
            });
        });

        test('Initialize can be called before setting process', async () => {
            writeTestIdsFileStub.resolves('/tmp/ids');
            const instance = new PytestSubprocessInstance(testRun.object, false, uri, 'pipe', ['test1']);

            await instance.initialize();
            assert.strictEqual(instance.testIdsFileName, '/tmp/ids');
            assert.strictEqual(instance.process, undefined);
        });

        test('Data can be received before process is set', async () => {
            const instance = new PytestSubprocessInstance(testRun.object, false, uri, 'pipe', []);

            const successPayload: ExecutionTestPayload = {
                status: 'success',
                cwd: '/test',
                result: {},
                error: '',
            };

            instance.handleDataReceivedEvent(successPayload);

            const result = await instance.getExecutionPromise();
            assert.deepStrictEqual(result, successPayload);
        });

        test('Cancellation token can be set multiple times', () => {
            const token1 = { cancelled: false };
            const token2 = { cancelled: true };
            const instance = new PytestSubprocessInstance(testRun.object, false, uri, 'pipe', []);

            instance.setCancellationToken(token1);
            assert.strictEqual(instance.isCancelled(), false);

            instance.setCancellationToken(token2);
            assert.strictEqual(instance.isCancelled(), true);
        });
    });
});
