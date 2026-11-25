// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { TestController, TestItem, Uri, Range, TestItemCollection } from 'vscode';
import * as typemoq from 'typemoq';
import * as assert from 'assert';
import * as sinon from 'sinon';
import { TestItemIndex } from '../../../../client/testing/testController/common/testItemIndex';

suite('TestItemIndex', () => {
    let testItemIndex: TestItemIndex;
    let testControllerMock: typemoq.IMock<TestController>;
    let mockTestItem1: TestItem;
    let mockTestItem2: TestItem;
    let mockParentItem: TestItem;

    setup(() => {
        testItemIndex = new TestItemIndex();
        testControllerMock = typemoq.Mock.ofType<TestController>();

        // Create mock test items
        mockTestItem1 = createMockTestItem('test1', 'Test 1');
        mockTestItem2 = createMockTestItem('test2', 'Test 2');
        mockParentItem = createMockTestItem('parent', 'Parent');
    });

    teardown(() => {
        sinon.restore();
    });

    suite('registerTestItem', () => {
        test('should store all three mappings correctly', () => {
            const runId = 'test_file.py::test_example';
            const vsId = 'test_file.py::test_example';

            testItemIndex.registerTestItem(runId, vsId, mockTestItem1);

            assert.strictEqual(testItemIndex.runIdToTestItemMap.get(runId), mockTestItem1);
            assert.strictEqual(testItemIndex.runIdToVSidMap.get(runId), vsId);
            assert.strictEqual(testItemIndex.vsIdToRunIdMap.get(vsId), runId);
        });

        test('should overwrite existing mappings', () => {
            const runId = 'test_file.py::test_example';
            const vsId = 'test_file.py::test_example';

            testItemIndex.registerTestItem(runId, vsId, mockTestItem1);
            testItemIndex.registerTestItem(runId, vsId, mockTestItem2);

            assert.strictEqual(testItemIndex.runIdToTestItemMap.get(runId), mockTestItem2);
        });

        test('should handle different runId and vsId', () => {
            const runId = 'test_file.py::TestClass::test_method';
            const vsId = 'different_id';

            testItemIndex.registerTestItem(runId, vsId, mockTestItem1);

            assert.strictEqual(testItemIndex.runIdToVSidMap.get(runId), vsId);
            assert.strictEqual(testItemIndex.vsIdToRunIdMap.get(vsId), runId);
        });
    });

    suite('getTestItem', () => {
        test('should return item on direct lookup when valid', () => {
            const runId = 'test_file.py::test_example';
            const vsId = 'test_file.py::test_example';

            // Register the item
            testItemIndex.registerTestItem(runId, vsId, mockTestItem1);

            // Mock the validation to return true
            const isValidStub = sinon.stub(testItemIndex, 'isTestItemValid').returns(true);

            const result = testItemIndex.getTestItem(runId, testControllerMock.object);

            assert.strictEqual(result, mockTestItem1);
            assert.ok(isValidStub.calledOnce);
        });

        test('should remove stale item and try vsId fallback', () => {
            const runId = 'test_file.py::test_example';
            const vsId = 'test_file.py::test_example';

            testItemIndex.registerTestItem(runId, vsId, mockTestItem1);

            // Mock validation to fail on first call (stale item)
            const isValidStub = sinon.stub(testItemIndex, 'isTestItemValid').returns(false);

            // Setup controller to not find the item
            const testItemCollectionMock = typemoq.Mock.ofType<TestItemCollection>();
            testItemCollectionMock.setup((x) => x.forEach(typemoq.It.isAny())).returns(() => undefined);
            testControllerMock.setup((t) => t.items).returns(() => testItemCollectionMock.object);

            const result = testItemIndex.getTestItem(runId, testControllerMock.object);

            // Should have removed the stale item
            assert.strictEqual(testItemIndex.runIdToTestItemMap.get(runId), undefined);
            assert.strictEqual(result, undefined);
            assert.ok(isValidStub.calledOnce);
        });

        test('should perform vsId search when direct lookup is stale', () => {
            const runId = 'test_file.py::test_example';
            const vsId = 'test_file.py::test_example';

            // Create test item with correct ID
            const searchableTestItem = createMockTestItem(vsId, 'Test Example');

            testItemIndex.registerTestItem(runId, vsId, searchableTestItem);

            // First validation fails (stale), need to search by vsId
            sinon.stub(testItemIndex, 'isTestItemValid').returns(false);

            // Setup controller to find item by vsId
            const testItemCollectionMock = typemoq.Mock.ofType<TestItemCollection>();
            testItemCollectionMock
                .setup((x) => x.forEach(typemoq.It.isAny()))
                .callback((callback) => {
                    callback(searchableTestItem);
                })
                .returns(() => undefined);
            testControllerMock.setup((t) => t.items).returns(() => testItemCollectionMock.object);

            const result = testItemIndex.getTestItem(runId, testControllerMock.object);

            // Should recache the found item
            assert.strictEqual(testItemIndex.runIdToTestItemMap.get(runId), searchableTestItem);
            assert.strictEqual(result, searchableTestItem);
        });

        test('should return undefined if not found anywhere', () => {
            const runId = 'nonexistent';

            const testItemCollectionMock = typemoq.Mock.ofType<TestItemCollection>();
            testItemCollectionMock.setup((x) => x.forEach(typemoq.It.isAny())).returns(() => undefined);
            testControllerMock.setup((t) => t.items).returns(() => testItemCollectionMock.object);

            const result = testItemIndex.getTestItem(runId, testControllerMock.object);

            assert.strictEqual(result, undefined);
        });
    });

    suite('getRunId and getVSId', () => {
        test('getRunId should convert VS Code ID to Python run ID', () => {
            const runId = 'test_file.py::test_example';
            const vsId = 'vscode_id';

            testItemIndex.registerTestItem(runId, vsId, mockTestItem1);

            assert.strictEqual(testItemIndex.getRunId(vsId), runId);
        });

        test('getRunId should return undefined for unknown vsId', () => {
            assert.strictEqual(testItemIndex.getRunId('unknown'), undefined);
        });

        test('getVSId should convert Python run ID to VS Code ID', () => {
            const runId = 'test_file.py::test_example';
            const vsId = 'vscode_id';

            testItemIndex.registerTestItem(runId, vsId, mockTestItem1);

            assert.strictEqual(testItemIndex.getVSId(runId), vsId);
        });

        test('getVSId should return undefined for unknown runId', () => {
            assert.strictEqual(testItemIndex.getVSId('unknown'), undefined);
        });
    });

    suite('clear', () => {
        test('should remove all mappings', () => {
            testItemIndex.registerTestItem('runId1', 'vsId1', mockTestItem1);
            testItemIndex.registerTestItem('runId2', 'vsId2', mockTestItem2);

            assert.strictEqual(testItemIndex.runIdToTestItemMap.size, 2);
            assert.strictEqual(testItemIndex.runIdToVSidMap.size, 2);
            assert.strictEqual(testItemIndex.vsIdToRunIdMap.size, 2);

            testItemIndex.clear();

            assert.strictEqual(testItemIndex.runIdToTestItemMap.size, 0);
            assert.strictEqual(testItemIndex.runIdToVSidMap.size, 0);
            assert.strictEqual(testItemIndex.vsIdToRunIdMap.size, 0);
        });

        test('should handle clearing empty index', () => {
            testItemIndex.clear();

            assert.strictEqual(testItemIndex.runIdToTestItemMap.size, 0);
            assert.strictEqual(testItemIndex.runIdToVSidMap.size, 0);
            assert.strictEqual(testItemIndex.vsIdToRunIdMap.size, 0);
        });
    });

    suite('isTestItemValid', () => {
        test('should return true for item with valid parent chain leading to controller', () => {
            const childItem = createMockTestItem('child', 'Child');
            (childItem as any).parent = mockParentItem;

            const testItemCollectionMock = typemoq.Mock.ofType<TestItemCollection>();
            testItemCollectionMock.setup((x) => x.get(mockParentItem.id)).returns(() => mockParentItem);
            testControllerMock.setup((t) => t.items).returns(() => testItemCollectionMock.object);

            const result = testItemIndex.isTestItemValid(childItem, testControllerMock.object);

            assert.strictEqual(result, true);
        });

        test('should return false for orphaned item', () => {
            const orphanedItem = createMockTestItem('orphaned', 'Orphaned');
            (orphanedItem as any).parent = mockParentItem;

            const testItemCollectionMock = typemoq.Mock.ofType<TestItemCollection>();
            testItemCollectionMock.setup((x) => x.get(typemoq.It.isAny())).returns(() => undefined);
            testControllerMock.setup((t) => t.items).returns(() => testItemCollectionMock.object);

            const result = testItemIndex.isTestItemValid(orphanedItem, testControllerMock.object);

            assert.strictEqual(result, false);
        });

        test('should return true for root item in controller', () => {
            const testItemCollectionMock = typemoq.Mock.ofType<TestItemCollection>();
            testItemCollectionMock.setup((x) => x.get(mockTestItem1.id)).returns(() => mockTestItem1);
            testControllerMock.setup((t) => t.items).returns(() => testItemCollectionMock.object);

            const result = testItemIndex.isTestItemValid(mockTestItem1, testControllerMock.object);

            assert.strictEqual(result, true);
        });

        test('should return false for item not in controller and no parent', () => {
            const testItemCollectionMock = typemoq.Mock.ofType<TestItemCollection>();
            testItemCollectionMock.setup((x) => x.get(typemoq.It.isAny())).returns(() => undefined);
            testControllerMock.setup((t) => t.items).returns(() => testItemCollectionMock.object);

            const result = testItemIndex.isTestItemValid(mockTestItem1, testControllerMock.object);

            assert.strictEqual(result, false);
        });
    });

    suite('cleanupStaleReferences', () => {
        test('should remove items not in controller', () => {
            const runId1 = 'test1';
            const runId2 = 'test2';
            const vsId1 = 'vs1';
            const vsId2 = 'vs2';

            testItemIndex.registerTestItem(runId1, vsId1, mockTestItem1);
            testItemIndex.registerTestItem(runId2, vsId2, mockTestItem2);

            // Mock validation: first item invalid, second valid
            const isValidStub = sinon.stub(testItemIndex, 'isTestItemValid');
            isValidStub.onFirstCall().returns(false); // mockTestItem1 is invalid
            isValidStub.onSecondCall().returns(true); // mockTestItem2 is valid

            testItemIndex.cleanupStaleReferences(testControllerMock.object);

            // First item should be removed
            assert.strictEqual(testItemIndex.runIdToTestItemMap.get(runId1), undefined);
            assert.strictEqual(testItemIndex.runIdToVSidMap.get(runId1), undefined);
            assert.strictEqual(testItemIndex.vsIdToRunIdMap.get(vsId1), undefined);

            // Second item should remain
            assert.strictEqual(testItemIndex.runIdToTestItemMap.get(runId2), mockTestItem2);
            assert.strictEqual(testItemIndex.runIdToVSidMap.get(runId2), vsId2);
            assert.strictEqual(testItemIndex.vsIdToRunIdMap.get(vsId2), runId2);
        });

        test('should keep all valid items', () => {
            const runId1 = 'test1';
            const vsId1 = 'vs1';

            testItemIndex.registerTestItem(runId1, vsId1, mockTestItem1);

            sinon.stub(testItemIndex, 'isTestItemValid').returns(true);

            testItemIndex.cleanupStaleReferences(testControllerMock.object);

            // Item should still be there
            assert.strictEqual(testItemIndex.runIdToTestItemMap.get(runId1), mockTestItem1);
            assert.strictEqual(testItemIndex.runIdToVSidMap.get(runId1), vsId1);
            assert.strictEqual(testItemIndex.vsIdToRunIdMap.get(vsId1), runId1);
        });

        test('should handle empty index', () => {
            testItemIndex.cleanupStaleReferences(testControllerMock.object);

            assert.strictEqual(testItemIndex.runIdToTestItemMap.size, 0);
        });

        test('should remove all items when all are invalid', () => {
            testItemIndex.registerTestItem('test1', 'vs1', mockTestItem1);
            testItemIndex.registerTestItem('test2', 'vs2', mockTestItem2);

            sinon.stub(testItemIndex, 'isTestItemValid').returns(false);

            testItemIndex.cleanupStaleReferences(testControllerMock.object);

            assert.strictEqual(testItemIndex.runIdToTestItemMap.size, 0);
            assert.strictEqual(testItemIndex.runIdToVSidMap.size, 0);
            assert.strictEqual(testItemIndex.vsIdToRunIdMap.size, 0);
        });
    });

    suite('Backward compatibility getters', () => {
        test('runIdToTestItemMap should return the internal map', () => {
            const runId = 'test1';
            testItemIndex.registerTestItem(runId, 'vs1', mockTestItem1);

            const map = testItemIndex.runIdToTestItemMap;

            assert.strictEqual(map.get(runId), mockTestItem1);
        });

        test('runIdToVSidMap should return the internal map', () => {
            const runId = 'test1';
            const vsId = 'vs1';
            testItemIndex.registerTestItem(runId, vsId, mockTestItem1);

            const map = testItemIndex.runIdToVSidMap;

            assert.strictEqual(map.get(runId), vsId);
        });

        test('vsIdToRunIdMap should return the internal map', () => {
            const runId = 'test1';
            const vsId = 'vs1';
            testItemIndex.registerTestItem(runId, vsId, mockTestItem1);

            const map = testItemIndex.vsIdToRunIdMap;

            assert.strictEqual(map.get(vsId), runId);
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
        uri: Uri.file('/foo/bar'),
        parent: undefined,
    } as unknown) as TestItem;

    return mockTestItem;
}
