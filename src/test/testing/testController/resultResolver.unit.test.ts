// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { TestController, Uri, TestItem, CancellationToken, TestRun, TestItemCollection, Range } from 'vscode';
import * as typemoq from 'typemoq';
import * as sinon from 'sinon';
import { TestProvider } from '../../../client/testing/types';
import {
    DiscoveredTestNode,
    DiscoveredTestPayload,
    ExecutionTestPayload,
} from '../../../client/testing/testController/common/types';
import * as testItemUtilities from '../../../client/testing/testController/common/testItemUtilities';
import * as ResultResolver from '../../../client/testing/testController/common/resultResolver';
import * as util from '../../../client/testing/testController/common/utils';

suite('Result Resolver tests', () => {
    suite('Test discovery', () => {
        let resultResolver: ResultResolver.PythonResultResolver;
        let testController: TestController;
        const log: string[] = [];
        let workspaceUri: Uri;
        let testProvider: TestProvider;
        let defaultErrorMessage: string;
        let blankTestItem: TestItem;
        let cancelationToken: CancellationToken;

        setup(() => {
            testController = ({
                items: {
                    get: () => {
                        log.push('get');
                    },
                    add: () => {
                        log.push('add');
                    },
                    replace: () => {
                        log.push('replace');
                    },
                    delete: () => {
                        log.push('delete');
                    },
                },

                dispose: () => {
                    // empty
                },
            } as unknown) as TestController;
            defaultErrorMessage = 'pytest test discovery error (see Output > Python)';
            blankTestItem = ({
                canResolveChildren: false,
                tags: [],
                children: {
                    add: () => {
                        // empty
                    },
                },
            } as unknown) as TestItem;
            cancelationToken = ({
                isCancellationRequested: false,
            } as unknown) as CancellationToken;
        });
        teardown(() => {
            sinon.restore();
        });

        test('resolveDiscovery calls populate test tree correctly', async () => {
            // test specific constants used expected values
            testProvider = 'pytest';
            workspaceUri = Uri.file('/foo/bar');
            resultResolver = new ResultResolver.PythonResultResolver(testController, testProvider, workspaceUri);
            const tests: DiscoveredTestNode = {
                path: 'path',
                name: 'name',
                type_: 'folder',
                id_: 'id',
                children: [],
            };
            const payload: DiscoveredTestPayload = {
                cwd: workspaceUri.fsPath,
                status: 'success',
                tests,
            };

            // stub out functionality of populateTestTreeStub which is called in resolveDiscovery
            const populateTestTreeStub = sinon.stub(util, 'populateTestTree').returns();

            // call resolve discovery
            resultResolver.resolveDiscovery(payload, cancelationToken);

            // assert the stub functions were called with the correct parameters

            // header of populateTestTree is (testController: TestController, testTreeData: DiscoveredTestNode, testRoot: TestItem | undefined, resultResolver: ITestResultResolver, token?: CancellationToken)
            sinon.assert.calledWithMatch(
                populateTestTreeStub,
                testController, // testController
                tests, // testTreeData
                undefined, // testRoot
                resultResolver, // resultResolver
                cancelationToken, // token
            );
        });
        // what about if the error node already exists: this.testController.items.get(`DiscoveryError:${workspacePath}`);
        test('resolveDiscovery should create error node on error with correct params', async () => {
            // test specific constants used expected values
            testProvider = 'pytest';
            workspaceUri = Uri.file('/foo/bar');
            resultResolver = new ResultResolver.PythonResultResolver(testController, testProvider, workspaceUri);
            const errorMessage = 'error msg A';
            const expectedErrorMessage = `${defaultErrorMessage}\r\n ${errorMessage}`;

            // stub out return values of functions called in resolveDiscovery
            const payload: DiscoveredTestPayload = {
                cwd: workspaceUri.fsPath,
                status: 'error',
                error: [errorMessage],
            };
            const errorTestItemOptions: testItemUtilities.ErrorTestItemOptions = {
                id: 'id',
                label: 'label',
                error: 'error',
            };

            // stub out functionality of buildErrorNodeOptions and createErrorTestItem which are called in resolveDiscovery
            const buildErrorNodeOptionsStub = sinon.stub(util, 'buildErrorNodeOptions').returns(errorTestItemOptions);
            const createErrorTestItemStub = sinon.stub(testItemUtilities, 'createErrorTestItem').returns(blankTestItem);

            // call resolve discovery
            resultResolver.resolveDiscovery(payload);

            // assert the stub functions were called with the correct parameters

            // header of buildErrorNodeOptions is (uri: Uri, message: string, testType: string)
            sinon.assert.calledWithMatch(buildErrorNodeOptionsStub, workspaceUri, expectedErrorMessage, testProvider);
            // header of createErrorTestItem is (options: ErrorTestItemOptions, testController: TestController, uri: Uri)
            sinon.assert.calledWithMatch(createErrorTestItemStub, sinon.match.any, sinon.match.any);
        });
    });
    suite('Test execution result resolver', () => {
        let resultResolver: ResultResolver.PythonResultResolver;
        const log: string[] = [];
        let workspaceUri: Uri;
        let testProvider: TestProvider;
        let cancelationToken: CancellationToken;
        let runInstance: typemoq.IMock<TestRun>;
        let testControllerMock: typemoq.IMock<TestController>;
        let mockTestItem1: TestItem;
        let mockTestItem2: TestItem;

        setup(() => {
            // create mock test items
            mockTestItem1 = createMockTestItem('mockTestItem1');
            mockTestItem2 = createMockTestItem('mockTestItem2');

            // create mock testItems to pass into a iterable
            const mockTestItems: [string, TestItem][] = [
                ['1', mockTestItem1],
                ['2', mockTestItem2],
            ];
            const iterableMock = mockTestItems[Symbol.iterator]();

            // create mock testItemCollection
            const testItemCollectionMock = typemoq.Mock.ofType<TestItemCollection>();
            testItemCollectionMock
                .setup((x) => x.forEach(typemoq.It.isAny()))
                .callback((callback) => {
                    let result = iterableMock.next();
                    while (!result.done) {
                        callback(result.value[1]);
                        result = iterableMock.next();
                    }
                })
                .returns(() => mockTestItem1);

            // create mock testController
            testControllerMock = typemoq.Mock.ofType<TestController>();
            testControllerMock.setup((t) => t.items).returns(() => testItemCollectionMock.object);

            cancelationToken = ({
                isCancellationRequested: false,
            } as unknown) as CancellationToken;

            // define functions within runInstance
            runInstance = typemoq.Mock.ofType<TestRun>();
            runInstance.setup((r) => r.name).returns(() => 'name');
            runInstance.setup((r) => r.token).returns(() => cancelationToken);
            runInstance.setup((r) => r.isPersisted).returns(() => true);
            runInstance
                .setup((r) => r.enqueued(typemoq.It.isAny()))
                .returns(() => {
                    // empty
                    log.push('enqueue');
                    return undefined;
                });
            runInstance
                .setup((r) => r.started(typemoq.It.isAny()))
                .returns(() => {
                    // empty
                    log.push('start');
                });

            // mock getTestCaseNodes to just return the given testNode added
            sinon.stub(testItemUtilities, 'getTestCaseNodes').callsFake((testNode: TestItem) => [testNode]);
        });
        teardown(() => {
            sinon.restore();
        });
        test('resolveExecution handles failed tests correctly', async () => {
            // test specific constants used expected values
            testProvider = 'pytest';
            workspaceUri = Uri.file('/foo/bar');
            resultResolver = new ResultResolver.PythonResultResolver(
                testControllerMock.object,
                testProvider,
                workspaceUri,
            );
            // add a mock test item to the map of known VSCode ids to run ids
            resultResolver.runIdToVSid.set('mockTestItem1', 'mockTestItem1');
            resultResolver.runIdToVSid.set('mockTestItem2', 'mockTestItem2');

            // add this mock test to the map of known test items
            resultResolver.runIdToTestItem.set('mockTestItem1', mockTestItem1);
            resultResolver.runIdToTestItem.set('mockTestItem2', mockTestItem2);

            // create a successful payload with a single test called mockTestItem1
            const successPayload: ExecutionTestPayload = {
                cwd: workspaceUri.fsPath,
                status: 'success',
                result: {
                    mockTestItem1: {
                        test: 'test',
                        outcome: 'failure', // failure, passed-unexpected, skipped, success, expected-failure, subtest-failure, subtest-succcess
                        message: 'message',
                        traceback: 'traceback',
                        subtest: 'subtest',
                    },
                },
                error: '',
            };

            // call resolveExecution
            resultResolver.resolveExecution(successPayload, runInstance.object);

            // verify that the passed function was called for the single test item
            runInstance.verify((r) => r.failed(typemoq.It.isAny(), typemoq.It.isAny()), typemoq.Times.once());
        });
        test('resolveExecution handles skipped correctly', async () => {
            // test specific constants used expected values
            testProvider = 'pytest';
            workspaceUri = Uri.file('/foo/bar');
            resultResolver = new ResultResolver.PythonResultResolver(
                testControllerMock.object,
                testProvider,
                workspaceUri,
            );
            // add a mock test item to the map of known VSCode ids to run ids
            resultResolver.runIdToVSid.set('mockTestItem1', 'mockTestItem1');
            resultResolver.runIdToVSid.set('mockTestItem2', 'mockTestItem2');

            // add this mock test to the map of known test items
            resultResolver.runIdToTestItem.set('mockTestItem1', mockTestItem1);
            resultResolver.runIdToTestItem.set('mockTestItem2', mockTestItem2);

            // create a successful payload with a single test called mockTestItem1
            const successPayload: ExecutionTestPayload = {
                cwd: workspaceUri.fsPath,
                status: 'success',
                result: {
                    mockTestItem1: {
                        test: 'test',
                        outcome: 'skipped', // failure, passed-unexpected, skipped, success, expected-failure, subtest-failure, subtest-succcess
                        message: 'message',
                        traceback: 'traceback',
                        subtest: 'subtest',
                    },
                },
                error: '',
            };

            // call resolveExecution
            resultResolver.resolveExecution(successPayload, runInstance.object);

            // verify that the passed function was called for the single test item
            runInstance.verify((r) => r.skipped(typemoq.It.isAny()), typemoq.Times.once());
        });
        test('resolveExecution handles success correctly', async () => {
            // test specific constants used expected values
            testProvider = 'pytest';
            workspaceUri = Uri.file('/foo/bar');
            resultResolver = new ResultResolver.PythonResultResolver(
                testControllerMock.object,
                testProvider,
                workspaceUri,
            );
            // add a mock test item to the map of known VSCode ids to run ids
            resultResolver.runIdToVSid.set('mockTestItem1', 'mockTestItem1');
            resultResolver.runIdToVSid.set('mockTestItem2', 'mockTestItem2');

            // add this mock test to the map of known test items
            resultResolver.runIdToTestItem.set('mockTestItem1', mockTestItem1);
            resultResolver.runIdToTestItem.set('mockTestItem2', mockTestItem2);

            // create a successful payload with a single test called mockTestItem1
            const successPayload: ExecutionTestPayload = {
                cwd: workspaceUri.fsPath,
                status: 'success',
                result: {
                    mockTestItem1: {
                        test: 'test',
                        outcome: 'success', // failure, passed-unexpected, skipped, success, expected-failure, subtest-failure, subtest-succcess
                        message: 'message',
                        traceback: 'traceback',
                        subtest: 'subtest',
                    },
                },
                error: '',
            };

            // call resolveExecution
            resultResolver.resolveExecution(successPayload, runInstance.object);

            // verify that the passed function was called for the single test item
            runInstance.verify((r) => r.passed(typemoq.It.isAny()), typemoq.Times.once());
        });
        test('resolveExecution handles error correctly', async () => {
            // test specific constants used expected values
            testProvider = 'pytest';
            workspaceUri = Uri.file('/foo/bar');
            resultResolver = new ResultResolver.PythonResultResolver(
                testControllerMock.object,
                testProvider,
                workspaceUri,
            );

            const errorPayload: ExecutionTestPayload = {
                cwd: workspaceUri.fsPath,
                status: 'error',
                error: 'error',
            };

            resultResolver.resolveExecution(errorPayload, runInstance.object);

            // verify that none of these functions are called

            runInstance.verify((r) => r.passed(typemoq.It.isAny()), typemoq.Times.never());
            runInstance.verify((r) => r.failed(typemoq.It.isAny(), typemoq.It.isAny()), typemoq.Times.never());
            runInstance.verify((r) => r.skipped(typemoq.It.isAny()), typemoq.Times.never());
        });
    });
});

function createMockTestItem(id: string): TestItem {
    const range = new Range(0, 0, 0, 0);
    const mockTestItem = ({
        id,
        canResolveChildren: false,
        tags: [],
        children: {
            add: () => {
                // empty
            },
        },
        range,
        uri: Uri.file('/foo/bar'),
    } as unknown) as TestItem;

    return mockTestItem;
}
