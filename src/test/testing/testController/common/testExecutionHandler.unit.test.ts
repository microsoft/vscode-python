// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { TestController, TestItem, TestRun, TestMessage, Uri, Range, TestItemCollection, MarkdownString } from 'vscode';
import * as typemoq from 'typemoq';
import * as assert from 'assert';
import * as sinon from 'sinon';
import { TestExecutionHandler } from '../../../../client/testing/testController/common/testExecutionHandler';
import { TestItemIndex } from '../../../../client/testing/testController/common/testItemIndex';
import { ExecutionTestPayload } from '../../../../client/testing/testController/common/types';

suite('TestExecutionHandler', () => {
    let executionHandler: TestExecutionHandler;
    let testControllerMock: typemoq.IMock<TestController>;
    let testItemIndexMock: typemoq.IMock<TestItemIndex>;
    let runInstanceMock: typemoq.IMock<TestRun>;
    let mockTestItem: TestItem;
    let mockParentItem: TestItem;

    setup(() => {
        executionHandler = new TestExecutionHandler();
        testControllerMock = typemoq.Mock.ofType<TestController>();
        testItemIndexMock = typemoq.Mock.ofType<TestItemIndex>();
        runInstanceMock = typemoq.Mock.ofType<TestRun>();

        mockTestItem = createMockTestItem('test1', 'Test 1');
        mockParentItem = createMockTestItem('parentTest', 'Parent Test');
    });

    teardown(() => {
        sinon.restore();
    });

    suite('processExecution', () => {
        test('should return empty stats for empty payload', () => {
            const payload: ExecutionTestPayload = {
                cwd: '/foo/bar',
                status: 'success',
                result: {},
                error: '',
            };

            const stats = executionHandler.processExecution(
                payload,
                runInstanceMock.object,
                testItemIndexMock.object,
                testControllerMock.object,
            );

            assert.strictEqual(stats.size, 0);
        });

        test('should return empty stats for undefined result', () => {
            const payload: ExecutionTestPayload = {
                cwd: '/foo/bar',
                status: 'success',
                error: '',
            };

            const stats = executionHandler.processExecution(
                payload,
                runInstanceMock.object,
                testItemIndexMock.object,
                testControllerMock.object,
            );

            assert.strictEqual(stats.size, 0);
        });

        test('should process multiple test results', () => {
            const payload: ExecutionTestPayload = {
                cwd: '/foo/bar',
                status: 'success',
                result: {
                    test1: { test: 'test1', outcome: 'success', message: '', traceback: '' },
                    test2: { test: 'test2', outcome: 'failure', message: 'Failed', traceback: 'traceback' },
                },
                error: '',
            };

            const mockTestItem2 = createMockTestItem('test2', 'Test 2');

            testItemIndexMock
                .setup((x) => x.getTestItem('test1', testControllerMock.object))
                .returns(() => mockTestItem);
            testItemIndexMock
                .setup((x) => x.getTestItem('test2', testControllerMock.object))
                .returns(() => mockTestItem2);

            executionHandler.processExecution(
                payload,
                runInstanceMock.object,
                testItemIndexMock.object,
                testControllerMock.object,
            );

            runInstanceMock.verify((r) => r.passed(mockTestItem), typemoq.Times.once());
            runInstanceMock.verify((r) => r.failed(mockTestItem2, typemoq.It.isAny()), typemoq.Times.once());
        });
    });

    suite('handleTestError', () => {
        test('should create error message with traceback', () => {
            const payload: ExecutionTestPayload = {
                cwd: '/foo/bar',
                status: 'success',
                result: {
                    test1: {
                        test: 'test1',
                        outcome: 'error',
                        message: 'Error occurred',
                        traceback: 'line1\nline2\nline3',
                    },
                },
                error: '',
            };

            testItemIndexMock
                .setup((x) => x.getTestItem('test1', testControllerMock.object))
                .returns(() => mockTestItem);

            let capturedMessage: TestMessage | undefined;
            runInstanceMock
                .setup((r) => r.errored(mockTestItem, typemoq.It.isAny()))
                .callback((_, message: TestMessage) => {
                    capturedMessage = message;
                });

            executionHandler.processExecution(
                payload,
                runInstanceMock.object,
                testItemIndexMock.object,
                testControllerMock.object,
            );

            assert.ok(capturedMessage);
            const messageText =
                capturedMessage!.message instanceof MarkdownString
                    ? capturedMessage!.message.value
                    : capturedMessage!.message;
            assert.ok(messageText.includes('Error occurred'));
            assert.ok(messageText.includes('line1'));
            assert.ok(messageText.includes('line2'));
            runInstanceMock.verify((r) => r.errored(mockTestItem, typemoq.It.isAny()), typemoq.Times.once());
        });

        test('should set location when test item has range', () => {
            const payload: ExecutionTestPayload = {
                cwd: '/foo/bar',
                status: 'success',
                result: {
                    test1: {
                        test: 'test1',
                        outcome: 'error',
                        message: 'Error',
                        traceback: '',
                    },
                },
                error: '',
            };

            testItemIndexMock
                .setup((x) => x.getTestItem('test1', testControllerMock.object))
                .returns(() => mockTestItem);

            let capturedMessage: TestMessage | undefined;
            runInstanceMock
                .setup((r) => r.errored(mockTestItem, typemoq.It.isAny()))
                .callback((_, message: TestMessage) => {
                    capturedMessage = message;
                });

            executionHandler.processExecution(
                payload,
                runInstanceMock.object,
                testItemIndexMock.object,
                testControllerMock.object,
            );

            assert.ok(capturedMessage);
            assert.ok(capturedMessage!.location);
            assert.strictEqual(capturedMessage!.location!.uri.fsPath, mockTestItem.uri!.fsPath);
        });

        test('should handle missing traceback', () => {
            const payload: ExecutionTestPayload = {
                cwd: '/foo/bar',
                status: 'success',
                result: {
                    test1: {
                        test: 'test1',
                        outcome: 'error',
                        message: 'Error',
                    },
                },
                error: '',
            };

            testItemIndexMock
                .setup((x) => x.getTestItem('test1', testControllerMock.object))
                .returns(() => mockTestItem);

            executionHandler.processExecution(
                payload,
                runInstanceMock.object,
                testItemIndexMock.object,
                testControllerMock.object,
            );

            runInstanceMock.verify((r) => r.errored(mockTestItem, typemoq.It.isAny()), typemoq.Times.once());
        });
    });

    suite('handleTestFailure', () => {
        test('should create failure message with traceback', () => {
            const payload: ExecutionTestPayload = {
                cwd: '/foo/bar',
                status: 'success',
                result: {
                    test1: {
                        test: 'test1',
                        outcome: 'failure',
                        message: 'Assertion failed',
                        traceback: 'AssertionError\nline1',
                    },
                },
                error: '',
            };

            testItemIndexMock
                .setup((x) => x.getTestItem('test1', testControllerMock.object))
                .returns(() => mockTestItem);

            let capturedMessage: TestMessage | undefined;
            runInstanceMock
                .setup((r) => r.failed(mockTestItem, typemoq.It.isAny()))
                .callback((_, message: TestMessage) => {
                    capturedMessage = message;
                });

            executionHandler.processExecution(
                payload,
                runInstanceMock.object,
                testItemIndexMock.object,
                testControllerMock.object,
            );

            assert.ok(capturedMessage);
            const messageText =
                capturedMessage!.message instanceof MarkdownString
                    ? capturedMessage!.message.value
                    : capturedMessage!.message;
            assert.ok(messageText.includes('Assertion failed'));
            assert.ok(messageText.includes('AssertionError'));
            runInstanceMock.verify((r) => r.failed(mockTestItem, typemoq.It.isAny()), typemoq.Times.once());
        });

        test('should handle passed-unexpected outcome', () => {
            const payload: ExecutionTestPayload = {
                cwd: '/foo/bar',
                status: 'success',
                result: {
                    test1: {
                        test: 'test1',
                        outcome: 'passed-unexpected',
                        message: 'Unexpected pass',
                        traceback: '',
                    },
                },
                error: '',
            };

            testItemIndexMock
                .setup((x) => x.getTestItem('test1', testControllerMock.object))
                .returns(() => mockTestItem);

            executionHandler.processExecution(
                payload,
                runInstanceMock.object,
                testItemIndexMock.object,
                testControllerMock.object,
            );

            runInstanceMock.verify((r) => r.failed(mockTestItem, typemoq.It.isAny()), typemoq.Times.once());
        });
    });

    suite('handleTestSuccess', () => {
        test('should mark test as passed', () => {
            const payload: ExecutionTestPayload = {
                cwd: '/foo/bar',
                status: 'success',
                result: {
                    test1: {
                        test: 'test1',
                        outcome: 'success',
                        message: '',
                        traceback: '',
                    },
                },
                error: '',
            };

            testItemIndexMock
                .setup((x) => x.getTestItem('test1', testControllerMock.object))
                .returns(() => mockTestItem);

            executionHandler.processExecution(
                payload,
                runInstanceMock.object,
                testItemIndexMock.object,
                testControllerMock.object,
            );

            runInstanceMock.verify((r) => r.passed(mockTestItem), typemoq.Times.once());
        });

        test('should handle expected-failure outcome', () => {
            const payload: ExecutionTestPayload = {
                cwd: '/foo/bar',
                status: 'success',
                result: {
                    test1: {
                        test: 'test1',
                        outcome: 'expected-failure',
                        message: '',
                        traceback: '',
                    },
                },
                error: '',
            };

            testItemIndexMock
                .setup((x) => x.getTestItem('test1', testControllerMock.object))
                .returns(() => mockTestItem);

            executionHandler.processExecution(
                payload,
                runInstanceMock.object,
                testItemIndexMock.object,
                testControllerMock.object,
            );

            runInstanceMock.verify((r) => r.passed(mockTestItem), typemoq.Times.once());
        });

        test('should not call passed when test item not found', () => {
            const payload: ExecutionTestPayload = {
                cwd: '/foo/bar',
                status: 'success',
                result: {
                    test1: {
                        test: 'test1',
                        outcome: 'success',
                        message: '',
                        traceback: '',
                    },
                },
                error: '',
            };

            testItemIndexMock.setup((x) => x.getTestItem('test1', testControllerMock.object)).returns(() => undefined);

            executionHandler.processExecution(
                payload,
                runInstanceMock.object,
                testItemIndexMock.object,
                testControllerMock.object,
            );

            runInstanceMock.verify((r) => r.passed(typemoq.It.isAny()), typemoq.Times.never());
        });
    });

    suite('handleTestSkipped', () => {
        test('should mark test as skipped', () => {
            const payload: ExecutionTestPayload = {
                cwd: '/foo/bar',
                status: 'success',
                result: {
                    test1: {
                        test: 'test1',
                        outcome: 'skipped',
                        message: 'Test skipped',
                        traceback: '',
                    },
                },
                error: '',
            };

            testItemIndexMock
                .setup((x) => x.getTestItem('test1', testControllerMock.object))
                .returns(() => mockTestItem);

            executionHandler.processExecution(
                payload,
                runInstanceMock.object,
                testItemIndexMock.object,
                testControllerMock.object,
            );

            runInstanceMock.verify((r) => r.skipped(mockTestItem), typemoq.Times.once());
        });
    });

    suite('handleSubtestFailure', () => {
        test('should create child test item for subtest', () => {
            const payload: ExecutionTestPayload = {
                cwd: '/foo/bar',
                status: 'success',
                result: {
                    'parentTest (subtest1)': {
                        test: 'parentTest',
                        outcome: 'subtest-failure',
                        message: 'Subtest failed',
                        traceback: 'traceback',
                        subtest: 'subtest1',
                    },
                },
                error: '',
            };

            const mockSubtestItem = createMockTestItem('subtest1', 'Subtest 1');

            testItemIndexMock
                .setup((x) => x.getTestItem('parentTest', testControllerMock.object))
                .returns(() => mockParentItem);
            testControllerMock
                .setup((t) => t.createTestItem(typemoq.It.isAny(), typemoq.It.isAny(), typemoq.It.isAny()))
                .returns(() => mockSubtestItem);

            const stats = executionHandler.processExecution(
                payload,
                runInstanceMock.object,
                testItemIndexMock.object,
                testControllerMock.object,
            );

            assert.strictEqual(stats.size, 1);
            assert.strictEqual(stats.get('parentTest')?.failed, 1);
            assert.strictEqual(stats.get('parentTest')?.passed, 0);

            runInstanceMock.verify((r) => r.started(mockSubtestItem), typemoq.Times.once());
            runInstanceMock.verify((r) => r.failed(mockSubtestItem, typemoq.It.isAny()), typemoq.Times.once());
        });

        test('should update stats correctly for multiple subtests', () => {
            const payload1: ExecutionTestPayload = {
                cwd: '/foo/bar',
                status: 'success',
                result: {
                    'parentTest (subtest1)': {
                        test: 'parentTest',
                        outcome: 'subtest-failure',
                        message: 'Failed',
                        traceback: '',
                        subtest: 'subtest1',
                    },
                },
                error: '',
            };

            const payload2: ExecutionTestPayload = {
                cwd: '/foo/bar',
                status: 'success',
                result: {
                    'parentTest (subtest2)': {
                        test: 'parentTest',
                        outcome: 'subtest-failure',
                        message: 'Failed',
                        traceback: '',
                        subtest: 'subtest2',
                    },
                },
                error: '',
            };

            const mockSubtest1 = createMockTestItem('subtest1', 'Subtest 1');
            const mockSubtest2 = createMockTestItem('subtest2', 'Subtest 2');

            testItemIndexMock
                .setup((x) => x.getTestItem('parentTest', testControllerMock.object))
                .returns(() => mockParentItem);

            // Return different items based on call order
            let callCount = 0;
            testControllerMock
                .setup((t) => t.createTestItem(typemoq.It.isAny(), typemoq.It.isAny(), typemoq.It.isAny()))
                .returns(() => {
                    callCount++;
                    return callCount === 1 ? mockSubtest1 : mockSubtest2;
                });

            const stats1 = executionHandler.processExecution(
                payload1,
                runInstanceMock.object,
                testItemIndexMock.object,
                testControllerMock.object,
            );

            // Process second subtest with stats from first
            const stats2 = executionHandler.processExecution(
                payload2,
                runInstanceMock.object,
                testItemIndexMock.object,
                testControllerMock.object,
            );

            // Verify stats are separate for each call
            assert.strictEqual(stats1.get('parentTest')?.failed, 1);
            assert.strictEqual(stats2.get('parentTest')?.failed, 1);
        });

        test('should throw error when parent test item not found', () => {
            const payload: ExecutionTestPayload = {
                cwd: '/foo/bar',
                status: 'success',
                result: {
                    'parentTest (subtest1)': {
                        test: 'parentTest',
                        outcome: 'subtest-failure',
                        message: 'Failed',
                        traceback: '',
                        subtest: 'subtest1',
                    },
                },
                error: '',
            };

            testItemIndexMock
                .setup((x) => x.getTestItem('parentTest', testControllerMock.object))
                .returns(() => undefined);

            assert.throws(() => {
                executionHandler.processExecution(
                    payload,
                    runInstanceMock.object,
                    testItemIndexMock.object,
                    testControllerMock.object,
                );
            }, /Parent test item not found/);
        });
    });

    suite('handleSubtestSuccess', () => {
        test('should create passing subtest', () => {
            const payload: ExecutionTestPayload = {
                cwd: '/foo/bar',
                status: 'success',
                result: {
                    'parentTest (subtest1)': {
                        test: 'parentTest',
                        outcome: 'subtest-success',
                        message: '',
                        traceback: '',
                        subtest: 'subtest1',
                    },
                },
                error: '',
            };

            const mockSubtestItem = createMockTestItem('subtest1', 'Subtest 1');

            testItemIndexMock
                .setup((x) => x.getTestItem('parentTest', testControllerMock.object))
                .returns(() => mockParentItem);
            testControllerMock
                .setup((t) => t.createTestItem(typemoq.It.isAny(), typemoq.It.isAny(), typemoq.It.isAny()))
                .returns(() => mockSubtestItem);

            const stats = executionHandler.processExecution(
                payload,
                runInstanceMock.object,
                testItemIndexMock.object,
                testControllerMock.object,
            );

            assert.strictEqual(stats.size, 1);
            assert.strictEqual(stats.get('parentTest')?.passed, 1);
            assert.strictEqual(stats.get('parentTest')?.failed, 0);

            runInstanceMock.verify((r) => r.started(mockSubtestItem), typemoq.Times.once());
            runInstanceMock.verify((r) => r.passed(mockSubtestItem), typemoq.Times.once());
        });

        test('should handle subtest with special characters in name', () => {
            const payload: ExecutionTestPayload = {
                cwd: '/foo/bar',
                status: 'success',
                result: {
                    'parentTest [subtest with spaces and [brackets]]': {
                        test: 'parentTest',
                        outcome: 'subtest-success',
                        message: '',
                        traceback: '',
                        subtest: 'subtest with spaces and [brackets]',
                    },
                },
                error: '',
            };

            const mockSubtestItem = createMockTestItem('[subtest with spaces and [brackets]]', 'Subtest');

            testItemIndexMock
                .setup((x) => x.getTestItem('parentTest', testControllerMock.object))
                .returns(() => mockParentItem);
            testControllerMock
                .setup((t) => t.createTestItem(typemoq.It.isAny(), typemoq.It.isAny(), typemoq.It.isAny()))
                .returns(() => mockSubtestItem);

            executionHandler.processExecution(
                payload,
                runInstanceMock.object,
                testItemIndexMock.object,
                testControllerMock.object,
            );

            runInstanceMock.verify((r) => r.passed(mockSubtestItem), typemoq.Times.once());
        });
    });
});

function createMockTestItem(id: string, label: string): TestItem {
    const range = new Range(0, 0, 0, 0);
    const mockChildren = typemoq.Mock.ofType<TestItemCollection>();
    mockChildren.setup((x) => x.add(typemoq.It.isAny())).returns(() => undefined);

    const mockTestItem = ({
        id,
        label,
        canResolveChildren: false,
        tags: [],
        children: mockChildren.object,
        range,
        uri: Uri.file('/foo/bar/test.py'),
        parent: undefined,
    } as unknown) as TestItem;

    return mockTestItem;
}
