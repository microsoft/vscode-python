// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { TestController, TestItem, Uri, CancellationToken, TestItemCollection } from 'vscode';
import * as typemoq from 'typemoq';
import * as assert from 'assert';
import * as sinon from 'sinon';
import { TestDiscoveryHandler } from '../../../../client/testing/testController/common/testDiscoveryHandler';
import { TestItemIndex } from '../../../../client/testing/testController/common/testItemIndex';
import { DiscoveredTestPayload, DiscoveredTestNode } from '../../../../client/testing/testController/common/types';
import { TestProvider } from '../../../../client/testing/types';
import * as utils from '../../../../client/testing/testController/common/utils';
import * as testItemUtilities from '../../../../client/testing/testController/common/testItemUtilities';

suite('TestDiscoveryHandler', () => {
    let discoveryHandler: TestDiscoveryHandler;
    let testControllerMock: typemoq.IMock<TestController>;
    let testItemIndexMock: typemoq.IMock<TestItemIndex>;
    let testItemCollectionMock: typemoq.IMock<TestItemCollection>;
    let workspaceUri: Uri;
    let testProvider: TestProvider;
    let cancelationToken: CancellationToken;

    setup(() => {
        discoveryHandler = new TestDiscoveryHandler();
        testControllerMock = typemoq.Mock.ofType<TestController>();
        testItemIndexMock = typemoq.Mock.ofType<TestItemIndex>();
        testItemCollectionMock = typemoq.Mock.ofType<TestItemCollection>();

        // Setup default test controller items mock
        testControllerMock.setup((t) => t.items).returns(() => testItemCollectionMock.object);
        testItemCollectionMock.setup((x) => x.delete(typemoq.It.isAny())).returns(() => undefined);
        testItemCollectionMock.setup((x) => x.get(typemoq.It.isAny())).returns(() => undefined);
        testItemCollectionMock.setup((x) => x.add(typemoq.It.isAny())).returns(() => undefined);

        workspaceUri = Uri.file('/foo/bar');
        testProvider = 'pytest';
        cancelationToken = ({
            isCancellationRequested: false,
        } as unknown) as CancellationToken;
    });

    teardown(() => {
        sinon.restore();
    });

    suite('processDiscovery', () => {
        test('should handle null payload gracefully', () => {
            discoveryHandler.processDiscovery(
                null as any,
                testControllerMock.object,
                testItemIndexMock.object,
                workspaceUri,
                testProvider,
                cancelationToken,
            );

            // Should not throw and should not call populateTestTree
            testItemIndexMock.verify((x) => x.clear(), typemoq.Times.never());
        });

        test('should call populateTestTree with correct params on success', () => {
            const tests: DiscoveredTestNode = {
                path: '/foo/bar',
                name: 'root',
                type_: 'folder',
                id_: 'root_id',
                children: [],
            };

            const payload: DiscoveredTestPayload = {
                cwd: workspaceUri.fsPath,
                status: 'success',
                tests,
            };

            const populateTestTreeStub = sinon.stub(utils, 'populateTestTree');
            testItemIndexMock.setup((x) => x.clear()).returns(() => undefined);

            // Setup map getters for populateTestTree
            const mockRunIdMap = new Map();
            const mockVSidMap = new Map();
            const mockVStoRunMap = new Map();
            testItemIndexMock.setup((x) => x.runIdToTestItemMap).returns(() => mockRunIdMap);
            testItemIndexMock.setup((x) => x.runIdToVSidMap).returns(() => mockVSidMap);
            testItemIndexMock.setup((x) => x.vsIdToRunIdMap).returns(() => mockVStoRunMap);

            discoveryHandler.processDiscovery(
                payload,
                testControllerMock.object,
                testItemIndexMock.object,
                workspaceUri,
                testProvider,
                cancelationToken,
            );

            testItemIndexMock.verify((x) => x.clear(), typemoq.Times.once());
            assert.ok(populateTestTreeStub.calledOnce);
            sinon.assert.calledWith(
                populateTestTreeStub,
                testControllerMock.object,
                tests,
                undefined,
                sinon.match.any,
                cancelationToken,
            );
        });

        test('should clear index before populating', () => {
            const tests: DiscoveredTestNode = {
                path: '/foo/bar',
                name: 'root',
                type_: 'folder',
                id_: 'root_id',
                children: [],
            };

            const payload: DiscoveredTestPayload = {
                cwd: workspaceUri.fsPath,
                status: 'success',
                tests,
            };

            sinon.stub(utils, 'populateTestTree');

            const clearSpy = sinon.spy();
            testItemIndexMock.setup((x) => x.clear()).callback(clearSpy);
            testItemIndexMock.setup((x) => x.runIdToTestItemMap).returns(() => new Map());
            testItemIndexMock.setup((x) => x.runIdToVSidMap).returns(() => new Map());
            testItemIndexMock.setup((x) => x.vsIdToRunIdMap).returns(() => new Map());

            discoveryHandler.processDiscovery(
                payload,
                testControllerMock.object,
                testItemIndexMock.object,
                workspaceUri,
                testProvider,
                cancelationToken,
            );

            assert.ok(clearSpy.calledOnce);
        });

        test('should handle error status and create error node', () => {
            const payload: DiscoveredTestPayload = {
                cwd: workspaceUri.fsPath,
                status: 'error',
                error: ['Error message 1', 'Error message 2'],
            };

            const createErrorNodeSpy = sinon.spy(discoveryHandler, 'createErrorNode');

            // Mock createTestItem to return a proper TestItem
            const mockErrorItem = ({
                id: 'error_id',
                error: null,
                canResolveChildren: false,
                tags: [],
            } as unknown) as TestItem;
            testControllerMock
                .setup((t) => t.createTestItem(typemoq.It.isAny(), typemoq.It.isAny()))
                .returns(() => mockErrorItem);

            discoveryHandler.processDiscovery(
                payload,
                testControllerMock.object,
                testItemIndexMock.object,
                workspaceUri,
                testProvider,
                cancelationToken,
            );

            assert.ok(createErrorNodeSpy.calledOnce);
            assert.ok(
                createErrorNodeSpy.calledWith(testControllerMock.object, workspaceUri, payload.error, testProvider),
            );
        });

        test('should handle both errors and tests in same payload', () => {
            const tests: DiscoveredTestNode = {
                path: '/foo/bar',
                name: 'root',
                type_: 'folder',
                id_: 'root_id',
                children: [],
            };

            const payload: DiscoveredTestPayload = {
                cwd: workspaceUri.fsPath,
                status: 'error',
                error: ['Partial error'],
                tests,
            };

            sinon.stub(utils, 'populateTestTree');
            const createErrorNodeSpy = sinon.spy(discoveryHandler, 'createErrorNode');

            // Mock createTestItem to return a proper TestItem
            const mockErrorItem = ({
                id: 'error_id',
                error: null,
                canResolveChildren: false,
                tags: [],
            } as unknown) as TestItem;
            testControllerMock
                .setup((t) => t.createTestItem(typemoq.It.isAny(), typemoq.It.isAny()))
                .returns(() => mockErrorItem);

            testItemIndexMock.setup((x) => x.clear()).returns(() => undefined);
            testItemIndexMock.setup((x) => x.runIdToTestItemMap).returns(() => new Map());
            testItemIndexMock.setup((x) => x.runIdToVSidMap).returns(() => new Map());
            testItemIndexMock.setup((x) => x.vsIdToRunIdMap).returns(() => new Map());

            discoveryHandler.processDiscovery(
                payload,
                testControllerMock.object,
                testItemIndexMock.object,
                workspaceUri,
                testProvider,
                cancelationToken,
            );

            // Should create error node AND populate test tree
            assert.ok(createErrorNodeSpy.calledOnce);
            testItemIndexMock.verify((x) => x.clear(), typemoq.Times.once());
        });

        test('should delete error node on successful discovery', () => {
            const tests: DiscoveredTestNode = {
                path: '/foo/bar',
                name: 'root',
                type_: 'folder',
                id_: 'root_id',
                children: [],
            };

            const payload: DiscoveredTestPayload = {
                cwd: workspaceUri.fsPath,
                status: 'success',
                tests,
            };

            const deleteSpy = sinon.spy();
            // Reset and reconfigure the collection mock to capture delete call
            testItemCollectionMock.reset();
            testItemCollectionMock
                .setup((x) => x.delete(typemoq.It.isAny()))
                .callback(deleteSpy)
                .returns(() => undefined);
            testItemCollectionMock.setup((x) => x.get(typemoq.It.isAny())).returns(() => undefined);
            testItemCollectionMock.setup((x) => x.add(typemoq.It.isAny())).returns(() => undefined);
            testControllerMock.reset();
            testControllerMock.setup((t) => t.items).returns(() => testItemCollectionMock.object);

            sinon.stub(utils, 'populateTestTree');
            testItemIndexMock.setup((x) => x.clear()).returns(() => undefined);
            testItemIndexMock.setup((x) => x.runIdToTestItemMap).returns(() => new Map());
            testItemIndexMock.setup((x) => x.runIdToVSidMap).returns(() => new Map());
            testItemIndexMock.setup((x) => x.vsIdToRunIdMap).returns(() => new Map());

            discoveryHandler.processDiscovery(
                payload,
                testControllerMock.object,
                testItemIndexMock.object,
                workspaceUri,
                testProvider,
                cancelationToken,
            );

            assert.ok(deleteSpy.calledOnce);
            assert.ok(deleteSpy.calledWith(`DiscoveryError:${workspaceUri.fsPath}`));
        });

        test('should respect cancellation token', () => {
            const tests: DiscoveredTestNode = {
                path: '/foo/bar',
                name: 'root',
                type_: 'folder',
                id_: 'root_id',
                children: [],
            };

            const payload: DiscoveredTestPayload = {
                cwd: workspaceUri.fsPath,
                status: 'success',
                tests,
            };

            const populateTestTreeStub = sinon.stub(utils, 'populateTestTree');
            testItemIndexMock.setup((x) => x.clear()).returns(() => undefined);
            testItemIndexMock.setup((x) => x.runIdToTestItemMap).returns(() => new Map());
            testItemIndexMock.setup((x) => x.runIdToVSidMap).returns(() => new Map());
            testItemIndexMock.setup((x) => x.vsIdToRunIdMap).returns(() => new Map());

            discoveryHandler.processDiscovery(
                payload,
                testControllerMock.object,
                testItemIndexMock.object,
                workspaceUri,
                testProvider,
                cancelationToken,
            );

            // Verify token was passed to populateTestTree
            assert.ok(populateTestTreeStub.calledOnce);
            const lastArg = populateTestTreeStub.getCall(0).args[4];
            assert.strictEqual(lastArg, cancelationToken);
        });

        test('should handle null tests in payload', () => {
            const payload: DiscoveredTestPayload = {
                cwd: workspaceUri.fsPath,
                status: 'success',
                tests: null as any,
            };

            const populateTestTreeStub = sinon.stub(utils, 'populateTestTree');
            testItemIndexMock.setup((x) => x.clear()).returns(() => undefined);
            testItemIndexMock.setup((x) => x.runIdToTestItemMap).returns(() => new Map());
            testItemIndexMock.setup((x) => x.runIdToVSidMap).returns(() => new Map());
            testItemIndexMock.setup((x) => x.vsIdToRunIdMap).returns(() => new Map());

            discoveryHandler.processDiscovery(
                payload,
                testControllerMock.object,
                testItemIndexMock.object,
                workspaceUri,
                testProvider,
                cancelationToken,
            );

            // Should still call populateTestTree with null
            assert.ok(populateTestTreeStub.calledOnce);
            testItemIndexMock.verify((x) => x.clear(), typemoq.Times.once());
        });
    });

    suite('createErrorNode', () => {
        test('should create error with correct message for pytest', () => {
            const error = ['Error line 1', 'Error line 2'];
            testProvider = 'pytest';

            const buildErrorNodeOptionsStub = sinon.stub(utils, 'buildErrorNodeOptions').returns({
                id: 'error_id',
                label: 'Error Label',
                error: 'Error Message',
            });

            const mockErrorItem = ({
                id: 'error_id',
                error: null,
            } as unknown) as TestItem;

            const createErrorTestItemStub = sinon.stub(testItemUtilities, 'createErrorTestItem').returns(mockErrorItem);

            const testItemCollectionMock = typemoq.Mock.ofType<TestItemCollection>();
            testItemCollectionMock.setup((x) => x.get(typemoq.It.isAny())).returns(() => undefined);
            testItemCollectionMock.setup((x) => x.add(typemoq.It.isAny())).returns(() => undefined);
            testControllerMock.setup((t) => t.items).returns(() => testItemCollectionMock.object);

            discoveryHandler.createErrorNode(testControllerMock.object, workspaceUri, error, testProvider);

            assert.ok(buildErrorNodeOptionsStub.calledOnce);
            assert.ok(createErrorTestItemStub.calledOnce);
            assert.ok(mockErrorItem.error !== null);
        });

        test('should create error with correct message for unittest', () => {
            const error = ['Unittest error'];
            testProvider = 'unittest';

            sinon.stub(utils, 'buildErrorNodeOptions').returns({
                id: 'error_id',
                label: 'Error Label',
                error: 'Error Message',
            });

            const mockErrorItem = ({
                id: 'error_id',
                error: null,
            } as unknown) as TestItem;

            sinon.stub(testItemUtilities, 'createErrorTestItem').returns(mockErrorItem);

            const testItemCollectionMock = typemoq.Mock.ofType<TestItemCollection>();
            testItemCollectionMock.setup((x) => x.get(typemoq.It.isAny())).returns(() => undefined);
            testItemCollectionMock.setup((x) => x.add(typemoq.It.isAny())).returns(() => undefined);
            testControllerMock.setup((t) => t.items).returns(() => testItemCollectionMock.object);

            discoveryHandler.createErrorNode(testControllerMock.object, workspaceUri, error, testProvider);

            assert.ok(mockErrorItem.error !== null);
        });

        test('should set markdown error label correctly', () => {
            const error = ['Test error'];

            sinon.stub(utils, 'buildErrorNodeOptions').returns({
                id: 'error_id',
                label: 'Error Label',
                error: 'Error Message',
            });

            const mockErrorItem = ({
                id: 'error_id',
                error: null,
            } as unknown) as TestItem;

            sinon.stub(testItemUtilities, 'createErrorTestItem').returns(mockErrorItem);

            const testItemCollectionMock = typemoq.Mock.ofType<TestItemCollection>();
            testItemCollectionMock.setup((x) => x.get(typemoq.It.isAny())).returns(() => undefined);
            testItemCollectionMock.setup((x) => x.add(typemoq.It.isAny())).returns(() => undefined);
            testControllerMock.setup((t) => t.items).returns(() => testItemCollectionMock.object);

            discoveryHandler.createErrorNode(testControllerMock.object, workspaceUri, error, testProvider);

            assert.ok(mockErrorItem.error);
            assert.strictEqual(
                (mockErrorItem.error as any).value,
                '[Show output](command:python.viewOutput) to view error logs',
            );
            assert.strictEqual((mockErrorItem.error as any).isTrusted, true);
        });

        test('should handle undefined error array', () => {
            sinon.stub(utils, 'buildErrorNodeOptions').returns({
                id: 'error_id',
                label: 'Error Label',
                error: 'Error Message',
            });

            const mockErrorItem = ({
                id: 'error_id',
                error: null,
            } as unknown) as TestItem;

            sinon.stub(testItemUtilities, 'createErrorTestItem').returns(mockErrorItem);

            const testItemCollectionMock = typemoq.Mock.ofType<TestItemCollection>();
            testItemCollectionMock.setup((x) => x.get(typemoq.It.isAny())).returns(() => undefined);
            testItemCollectionMock.setup((x) => x.add(typemoq.It.isAny())).returns(() => undefined);
            testControllerMock.setup((t) => t.items).returns(() => testItemCollectionMock.object);

            discoveryHandler.createErrorNode(testControllerMock.object, workspaceUri, undefined, testProvider);

            // Should not throw
            assert.ok(mockErrorItem.error !== null);
        });

        test('should reuse existing error node if present', () => {
            const error = ['Error'];

            // Create a proper object with settable error property
            const existingErrorItem: any = {
                id: `DiscoveryError:${workspaceUri.fsPath}`,
                error: null,
                canResolveChildren: false,
                tags: [],
            };

            sinon.stub(utils, 'buildErrorNodeOptions').returns({
                id: `DiscoveryError:${workspaceUri.fsPath}`,
                label: 'Error Label',
                error: 'Error Message',
            });

            const createErrorTestItemStub = sinon.stub(testItemUtilities, 'createErrorTestItem');

            // Reset and setup collection to return existing item
            testItemCollectionMock.reset();
            testItemCollectionMock
                .setup((x) => x.get(`DiscoveryError:${workspaceUri.fsPath}`))
                .returns(() => existingErrorItem);
            testItemCollectionMock.setup((x) => x.add(typemoq.It.isAny())).returns(() => undefined);
            testControllerMock.reset();
            testControllerMock.setup((t) => t.items).returns(() => testItemCollectionMock.object);

            discoveryHandler.createErrorNode(testControllerMock.object, workspaceUri, error, testProvider);

            // Should not create a new error item
            assert.ok(createErrorTestItemStub.notCalled);
            // Should still update the error property
            assert.ok(existingErrorItem.error !== null);
        });

        test('should handle multiple error messages', () => {
            const error = ['Error 1', 'Error 2', 'Error 3'];

            const buildStub = sinon.stub(utils, 'buildErrorNodeOptions').returns({
                id: 'error_id',
                label: 'Error Label',
                error: 'Error Message',
            });

            const mockErrorItem = ({
                id: 'error_id',
                error: null,
            } as unknown) as TestItem;

            sinon.stub(testItemUtilities, 'createErrorTestItem').returns(mockErrorItem);

            const testItemCollectionMock = typemoq.Mock.ofType<TestItemCollection>();
            testItemCollectionMock.setup((x) => x.get(typemoq.It.isAny())).returns(() => undefined);
            testItemCollectionMock.setup((x) => x.add(typemoq.It.isAny())).returns(() => undefined);
            testControllerMock.setup((t) => t.items).returns(() => testItemCollectionMock.object);

            discoveryHandler.createErrorNode(testControllerMock.object, workspaceUri, error, testProvider);

            // Verify the error messages are joined
            const expectedMessage = sinon.match((value: string) => {
                return value.includes('Error 1') && value.includes('Error 2') && value.includes('Error 3');
            });
            sinon.assert.calledWith(buildStub, workspaceUri, expectedMessage, testProvider);
        });
    });
});
