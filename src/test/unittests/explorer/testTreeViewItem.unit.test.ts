// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { Uri } from 'vscode';
import {
    TestFile, TestFolder,
    TestFunction, TestSuite
} from '../../../client/unittests/common/types';
import {
    createTreeViewItemFrom, TestTreeItem
} from '../../../client/unittests/explorer/testTreeViewItem';
import { getTestExplorerViewItemData } from './explorerTestData';

suite('Unit Tests Test Explorer View Items', () => {
    let testFolder: TestFolder;
    let testFile: TestFile;
    let testSuite: TestSuite;
    let testFunction: TestFunction;
    let testSuiteFunction: TestFunction;
    const resource = Uri.file(__filename);
    setup(() => {
        [testFolder, testFile, testFunction, testSuite, testSuiteFunction] = getTestExplorerViewItemData();
    });

    test('Test folder created into test view item', () => {
        const viewItem: TestTreeItem = createTreeViewItemFrom(resource, testFolder, undefined);
        expect(viewItem.contextValue).is.equal('testFolder');
    });

    test('Test file created into test view item', () => {
        const viewItem: TestTreeItem = createTreeViewItemFrom(resource, testFile, testFolder);
        expect(viewItem.contextValue).is.equal('testFile');
    });

    test('Test folder created into test view item', () => {
        const viewItem: TestTreeItem = createTreeViewItemFrom(resource, testSuite, testFile);
        expect(viewItem.contextValue).is.equal('testSuite');
    });

    test('Test folder created into test view item', () => {
        const viewItem: TestTreeItem = createTreeViewItemFrom(resource, testFunction, testFile);
        expect(viewItem.contextValue).is.equal('testFunction');
    });

    test('Test folder created into test view item', () => {
        const viewItem: TestTreeItem = createTreeViewItemFrom(resource, testSuiteFunction, testSuite);
        expect(viewItem.contextValue).is.equal('testFunction');
    });
});
