// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import { TestItem } from 'vscode';
import {
    DebugTestTag,
    expandExcludeSet,
    getTestCaseNodes,
    RunTestTag,
} from '../../../client/testing/testController/common/testItemUtilities';

function createMockTestItem(id: string, canResolveChildren: boolean, children: TestItem[] = []): TestItem {
    return ({
        id,
        canResolveChildren,
        tags: [RunTestTag, DebugTestTag],
        children: {
            forEach: (callback: (item: TestItem) => void) => children.forEach(callback),
            size: children.length,
        },
    } as unknown) as TestItem;
}

suite('expandExcludeSet', () => {
    test('should return undefined when there is nothing to exclude', () => {
        assert.strictEqual(expandExcludeSet(undefined), undefined);
        assert.strictEqual(expandExcludeSet([]), undefined);
    });

    test('should include the excluded item itself', () => {
        const item = createMockTestItem('leaf', false);
        const result = expandExcludeSet([item]);
        assert.deepStrictEqual(result, new Set([item]));
    });

    test('should include all descendants of excluded items', () => {
        const grandchild = createMockTestItem('grandchild', false);
        const child1 = createMockTestItem('child1', true, [grandchild]);
        const child2 = createMockTestItem('child2', false);
        const parent = createMockTestItem('parent', true, [child1, child2]);
        const result = expandExcludeSet([parent]);
        assert.deepStrictEqual(result, new Set([parent, child1, child2, grandchild]));
    });

    test('should handle overlapping excluded items', () => {
        const child = createMockTestItem('child', false);
        const parent = createMockTestItem('parent', true, [child]);
        const result = expandExcludeSet([parent, child]);
        assert.deepStrictEqual(result, new Set([parent, child]));
    });
});

suite('getTestCaseNodes with an exclude set', () => {
    test('should collect leaf test nodes without an exclude set', () => {
        const leaf1 = createMockTestItem('leaf1', false);
        const leaf2 = createMockTestItem('leaf2', false);
        const parent = createMockTestItem('parent', true, [leaf1, leaf2]);
        assert.deepStrictEqual(getTestCaseNodes(parent), [leaf1, leaf2]);
    });

    test('should skip excluded leaf nodes', () => {
        const leaf1 = createMockTestItem('leaf1', false);
        const leaf2 = createMockTestItem('leaf2', false);
        const parent = createMockTestItem('parent', true, [leaf1, leaf2]);
        assert.deepStrictEqual(getTestCaseNodes(parent, [], expandExcludeSet([leaf1])), [leaf2]);
    });

    test('should skip the whole subtree of an excluded node', () => {
        const leaf1 = createMockTestItem('leaf1', false);
        const leaf2 = createMockTestItem('leaf2', false);
        const folder = createMockTestItem('folder', true, [leaf1]);
        const root = createMockTestItem('root', true, [folder, leaf2]);
        assert.deepStrictEqual(getTestCaseNodes(root, [], expandExcludeSet([folder])), [leaf2]);
    });

    test('should return nothing when the requested node is excluded', () => {
        const leaf = createMockTestItem('leaf', false);
        const root = createMockTestItem('root', true, [leaf]);
        assert.deepStrictEqual(getTestCaseNodes(root, [], expandExcludeSet([root])), []);
    });
});
