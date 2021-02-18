// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { getChildren, getParent } from '../testUtils';
import { TestDataItem, Tests } from '../types';

export type Visitor = (item: TestDataItem) => void;

/**
 * Vists tests recursively.
 *
 * @export
 * @param {Tests} tests
 * @param {Visitor} visitor
 */
export function visitRecursive(tests: Tests, visitor: Visitor): void;

/**
 * Vists tests recursively.
 *
 * @export
 * @param {Tests} tests
 * @param {TestDataItem} start
 * @param {Visitor} visitor
 */
export function visitRecursive(tests: Tests, start: TestDataItem, visitor: Visitor): void;
export function visitRecursive(tests: Tests, arg1: TestDataItem | Visitor, arg2?: Visitor): void {
    const startItem = typeof arg1 === 'function' ? undefined : arg1;
    const visitor = startItem ? arg2! : (arg1 as Visitor);
    let children: TestDataItem[] = [];
    if (startItem) {
        visitor(startItem);
        children = getChildren(startItem);
    } else {
        children = tests.rootTestFolders;
    }
    children.forEach((folder) => visitRecursive(tests, folder, visitor));
}

/**
 * Visits parents recursively.
 *
 * @export
 * @param {Tests} tests
 * @param {TestDataItem} startItem
 * @param {Visitor} visitor
 * @returns {void}
 */
export function visitParentsRecursive(tests: Tests, startItem: TestDataItem, visitor: Visitor): void {
    visitor(startItem);
    const parent = getParent(tests, startItem);
    if (!parent) {
        return;
    }
    visitor(parent);
    visitParentsRecursive(tests, parent, visitor);
}
