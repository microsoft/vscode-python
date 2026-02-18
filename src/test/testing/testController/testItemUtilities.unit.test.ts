import * as assert from 'assert';
import { TestItem } from 'vscode';
import {
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
