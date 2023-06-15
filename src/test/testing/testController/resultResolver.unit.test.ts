// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { TestController, Uri, TestItem, CancellationToken, TestRun, TestItemCollection } from 'vscode';
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
                // createTestItem: (id: string, label: string, urih?: Uri) => {
                //     testItem;
                // },
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
                errors: [errorMessage],
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
        // let testController: TestController;
        const log: string[] = [];
        let workspaceUri: Uri;
        let testProvider: TestProvider;
        let cancelationToken: CancellationToken;
        let runInstance: typemoq.IMock<TestRun>;
        let passedMock: typemoq.IMock<TestRun['passed']>;
        // let testMessageMock: typemoq.IMock<TestMessage>;
        let testControllerMock: typemoq.IMock<TestController>;

        setup(() => {
            const blankTestItem2 = ({
                id: 'id',
                canResolveChildren: false,
                tags: [],
                children: {
                    add: () => {
                        // empty
                    },
                },
            } as unknown) as TestItem;
            const blankTestItem3 = ({
                id: 'id3',
                canResolveChildren: false,
                tags: [],
                children: {
                    add: () => {
                        // empty
                    },
                },
            } as unknown) as TestItem;

            const mockTestItems: [string, TestItem][] = [
                ['1', blankTestItem2],
                ['2', blankTestItem3],
                // Add as many mock TestItems as needed
            ];

            const iterableMock = mockTestItems[Symbol.iterator]();

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
                .returns(() => {
                    console.log('inside for each');

                    return blankTestItem2;
                });

            // const testItemCollection = typemoq.Mock.ofType<TestItemCollection>();
            // testItemCollection.setup((t) => t.get(typemoq.It.isAnyString())).returns(() => blankTestItem2);
            // testItemCollection
            //     .setup((t) => t.forEach(typemoq.It.isAny()))
            //     .returns(() => {
            //         console.log('second');
            //     });
            testControllerMock = typemoq.Mock.ofType<TestController>();
            testControllerMock
                .setup((t) => t.items)
                .returns(() => {
                    console.log('hi');
                    return testItemCollectionMock.object;
                });

            // testController = ({
            //     items: {
            //         get: () => {
            //             log.push('get');
            //         },
            //         add: () => {
            //             log.push('add');
            //         },
            //         replace: () => {
            //             log.push('replace');
            //         },
            //         delete: () => {
            //             log.push('delete');
            //         },
            //         forEach: (items: unknown) => {
            //             log.push('forEach');
            //             return items;
            //             // return [blankTestItem2];
            //         },
            //     },
            //     // createTestItem: (id: string, label: string, urih?: Uri) => {
            //     //     testItem;
            //     // },
            //     dispose: () => {
            //         // empty
            //     },
            // } as unknown) as TestController;
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

            // mock pass
            passedMock = typemoq.Mock.ofType<TestRun['passed']>();
            runInstance
                .setup((r) => r.passed(typemoq.It.isAny()))
                .returns(() => {
                    passedMock.object(typemoq.It.isAny());
                    log.push('start');
                });
        });
        teardown(() => {
            sinon.restore();
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
            resultResolver.runIdToVSid.set('id', 'id');
            const successPayload: ExecutionTestPayload = {
                cwd: workspaceUri.fsPath,
                status: 'success',
                result: {
                    testRunID: {
                        test: 'test',
                        outcome: 'success', // failure, passed-unexpected, skipped, success, expected-failure, subtest-failure, subtest-succcess
                        message: 'message',
                        traceback: 'traceback',
                        subtest: 'subtest',
                    },
                },
                error: '',
            };
            const blankTestItem = ({
                canResolveChildren: false,
                tags: [],
                children: {
                    add: () => {
                        // empty
                    },
                },
            } as unknown) as TestItem;

            sinon.stub(testItemUtilities, 'getTestCaseNodes').returns([blankTestItem]);
            resultResolver.resolveExecution(successPayload, runInstance.object);
        });
        // test('resolveExecution handles error correctly', async () => {
        //     // test specific constants used expected values
        //     testProvider = 'pytest';
        //     workspaceUri = Uri.file('/foo/bar');
        //     resultResolver = new ResultResolver.PythonResultResolver(testController, testProvider, workspaceUri);

        //     const errorPayload: ExecutionTestPayload = {
        //         cwd: workspaceUri.fsPath,
        //         status: 'error',
        //         error: 'error',
        //     };

        //     resultResolver.resolveExecution(errorPayload, runInstance.object);

        //     // verify that none of these functions are called
        //     passedMock.verify((f) => f(typemoq.It.isAny()), typemoq.Times.never());
        // });
    });
});
