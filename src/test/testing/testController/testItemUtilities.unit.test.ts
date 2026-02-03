import * as assert from 'assert';
import { TestItem } from 'vscode';
import {
    isTestItemExcluded,
    expandExcludeSet,
    getTestCaseNodes,
    RunTestTag,
    DebugTestTag,
} from '../../../client/testing/testController/common/testItemUtilities';

function createMockTestItem(id: string, canResolveChildren: boolean, children: TestItem[] = []): TestItem {
    const item = {
        id,
        canResolveChildren,
        tags: [RunTestTag, DebugTestTag],
        children: {
            forEach: (callback: (item: TestItem) => void) => {
                children.forEach(callback);
            },
            size: children.length,
        },
        parent: undefined as TestItem | undefined,
    } as any;
    // Set parent references on children
    children.forEach((child) => {
        (child as any).parent = item;
    });
    return item;
}

suite('isTestItemExcluded', () => {
    test('should return false when excludeSet is undefined', () => {
        const item = createMockTestItem('item1', false);
        assert.strictEqual(isTestItemExcluded(item, undefined), false);
    });

    test('should return false when excludeSet is empty', () => {
        const item = createMockTestItem('item1', false);
        assert.strictEqual(isTestItemExcluded(item, new Set()), false);
    });

    test('should return true when item is directly in excludeSet', () => {
        const item = createMockTestItem('item1', false);
        const excludeSet = new Set([item]);
        assert.strictEqual(isTestItemExcluded(item, excludeSet), true);
    });

    test('should return true when ancestor is in excludeSet', () => {
        const child = createMockTestItem('child', false);
        const parent = createMockTestItem('parent', true, [child]);
        const excludeSet = new Set([parent]);
        assert.strictEqual(isTestItemExcluded(child, excludeSet), true);
    });

    test('should return false when unrelated item is in excludeSet', () => {
        const child = createMockTestItem('child', false);
        createMockTestItem('parent', true, [child]);
        const other = createMockTestItem('other', false);
        const excludeSet = new Set([other]);
        assert.strictEqual(isTestItemExcluded(child, excludeSet), false);
    });

    test('should walk multiple levels of ancestor chain', () => {
        const grandchild = createMockTestItem('grandchild', false);
        const child = createMockTestItem('child', true, [grandchild]);
        const root = createMockTestItem('root', true, [child]);
        const excludeSet = new Set([root]);
        assert.strictEqual(isTestItemExcluded(grandchild, excludeSet), true);
    });
});

suite('expandExcludeSet', () => {
    test('should return undefined when excludeSet is undefined', () => {
        assert.strictEqual(expandExcludeSet(undefined), undefined);
    });

    test('should return empty set when excludeSet is empty', () => {
        const result = expandExcludeSet(new Set());
        assert.ok(result);
        assert.strictEqual(result!.size, 0);
    });

    test('should include the excluded item itself', () => {
        const item = createMockTestItem('leaf', false);
        const result = expandExcludeSet(new Set([item]));
        assert.ok(result);
        assert.ok(result!.has(item));
    });

    test('should include all descendants of excluded items', () => {
        const child1 = createMockTestItem('child1', false);
        const child2 = createMockTestItem('child2', false);
        const parent = createMockTestItem('parent', true, [child1, child2]);
        const result = expandExcludeSet(new Set([parent]));
        assert.ok(result);
        assert.strictEqual(result!.size, 3);
        assert.ok(result!.has(parent));
        assert.ok(result!.has(child1));
        assert.ok(result!.has(child2));
    });

    test('should include deeply nested descendants', () => {
        const grandchild = createMockTestItem('grandchild', false);
        const child = createMockTestItem('child', true, [grandchild]);
        const root = createMockTestItem('root', true, [child]);
        const result = expandExcludeSet(new Set([root]));
        assert.ok(result);
        assert.strictEqual(result!.size, 3);
        assert.ok(result!.has(root));
        assert.ok(result!.has(child));
        assert.ok(result!.has(grandchild));
    });
});

suite('getTestCaseNodes with exclude and visited', () => {
    test('should collect leaf test nodes', () => {
        const leaf1 = createMockTestItem('leaf1', false);
        const leaf2 = createMockTestItem('leaf2', false);
        const parent = createMockTestItem('parent', true, [leaf1, leaf2]);
        const result = getTestCaseNodes(parent);
        assert.strictEqual(result.length, 2);
        assert.ok(result.includes(leaf1));
        assert.ok(result.includes(leaf2));
    });

    test('should skip nodes in excludeSet', () => {
        const leaf1 = createMockTestItem('leaf1', false);
        const leaf2 = createMockTestItem('leaf2', false);
        const parent = createMockTestItem('parent', true, [leaf1, leaf2]);
        const excludeSet = new Set([leaf1]);
        const result = getTestCaseNodes(parent, [], new Set(), excludeSet);
        assert.strictEqual(result.length, 1);
        assert.ok(result.includes(leaf2));
    });

    test('should skip entire subtree when parent is in excludeSet', () => {
        const leaf = createMockTestItem('leaf', false);
        const folder = createMockTestItem('folder', true, [leaf]);
        const root = createMockTestItem('root', true, [folder]);
        // Pre-expanded excludeSet (as expandExcludeSet would produce)
        const excludeSet = new Set([folder, leaf]);
        const result = getTestCaseNodes(root, [], new Set(), excludeSet);
        assert.strictEqual(result.length, 0);
    });

    test('should not visit same node twice when visited set is used', () => {
        const leaf = createMockTestItem('leaf', false);
        const parent = createMockTestItem('parent', true, [leaf]);
        const visited = new Set<TestItem>();
        const collection: TestItem[] = [];
        getTestCaseNodes(parent, collection, visited);
        getTestCaseNodes(parent, collection, visited);
        assert.strictEqual(collection.length, 1);
    });

    test('should work without optional visited and excludeSet parameters', () => {
        const leaf = createMockTestItem('leaf', false);
        const parent = createMockTestItem('parent', true, [leaf]);
        const result = getTestCaseNodes(parent);
        assert.strictEqual(result.length, 1);
        assert.ok(result.includes(leaf));
    });

    test('should skip excluded root node entirely', () => {
        const leaf = createMockTestItem('leaf', false);
        const root = createMockTestItem('root', true, [leaf]);
        const excludeSet = new Set([root, leaf]);
        const result = getTestCaseNodes(root, [], new Set(), excludeSet);
        assert.strictEqual(result.length, 0);
    });
});
