// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import {
    TestFile, TestFolder,
    TestFunction, TestSuite
} from '../../../client/unittests/common/types';
import {
    createTreeViewItemFrom, TestTreeItem
} from '../../../client/unittests/explorer/testTreeViewItem';
import { getTestExplorerViewItemData } from './explorerTestData';

// tslint:disable-next-line:max-func-body-length
suite('Unit Tests Test Explorer View Items', () => {
    let testFolder: TestFolder;
    let testFile: TestFile;
    let testSuite: TestSuite;
    let testFunction: TestFunction;
    let testSuiteFunction: TestFunction;

    setup(() => {
        [testFolder, testFile, testFunction, testSuite, testSuiteFunction] = getTestExplorerViewItemData();
    });

    test('Test folder created into test view item', () => {
        const viewItem: TestTreeItem = createTreeViewItemFrom(undefined, testFolder, undefined);
        expect(viewItem.contextValue).is.equal('testFolder');
    });

    test('Test file created into test view item', () => {
        const viewItem: TestTreeItem = createTreeViewItemFrom(undefined, testFile, testFolder);
        expect(viewItem.contextValue).is.equal('testFile');
    });

    test('Test folder created into test view item', () => {
        const viewItem: TestTreeItem = createTreeViewItemFrom(undefined, testSuite, testFile);
        expect(viewItem.contextValue).is.equal('testSuite');
    });

    test('Test folder created into test view item', () => {
        const viewItem: TestTreeItem = createTreeViewItemFrom(undefined, testFunction, testFile);
        expect(viewItem.contextValue).is.equal('testFunction');
    });

    test('Test folder created into test view item', () => {
        const viewItem: TestTreeItem = createTreeViewItemFrom(undefined, testSuiteFunction, testSuite);
        expect(viewItem.contextValue).is.equal('testFunction');
    });

    test('Children of test folders are only files.', () => {
        const viewItem: TestTreeItem = createTreeViewItemFrom(undefined, testFolder, undefined);
        const childrenItems: TestTreeItem[] = viewItem.children;
        expect(childrenItems.length).to.be.greaterThan(0);
        childrenItems.forEach((item: TestTreeItem) => {
            expect(item.contextValue).to.equal('testFile');
        });
    });

    test('Children of test files are only test functions and suites.', () => {
        const viewItem: TestTreeItem = createTreeViewItemFrom(undefined, testFile, undefined);
        const childrenItems: TestTreeItem[] = viewItem.children;
        expect(childrenItems.length).to.be.greaterThan(0);
        childrenItems.forEach((item: TestTreeItem) => {
            expect(item.contextValue).is.oneOf(['testFunction', 'testSuite']);
        });
    });

    test('Children of test suites are only test functions.', () => {
        const viewItem: TestTreeItem = createTreeViewItemFrom(undefined, testSuite, undefined);
        const childrenItems: TestTreeItem[] = viewItem.children;
        expect(childrenItems.length).to.be.greaterThan(0);
        childrenItems.forEach((item: TestTreeItem) => {
            expect(item.contextValue).to.equal('testFunction');
        });
    });
});
