// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import {
    TestFile, TestFolder,
    TestFunction, TestSuite
} from '../../../client/unittests/common/types';
import { createTreeViewItemFrom, TestTreeItem } from '../../../client/unittests/explorer/testTreeViewItem';

// Issuing the command pallette command(s) and observing when:

//     A test file is added/removed/renamed
//     A test suite is added/removed/renamed
//     A test function is added/removed/renamed
//     A test function was successful but has started to failed
//     A test function was failing but has started to succeed
//     A test function was skipped but is now being run successfully
//     A test function was skipped but is now being run unsuccessfully
//     A test function was running but is now being skipped
//     All the above state changes for functions, applied to suites (can Python suites be skipped?)

// tslint:disable-next-line:max-func-body-length
suite('Unit Tests Test Explorer View Items', () => {
    let testFolder: TestFolder;
    let testFile: TestFile;
    let testSuite: TestSuite;
    let testFunction: TestFunction;
    let testSuiteFunction: TestFunction;

    setup(() => {
        testSuiteFunction = {
            name: 'test_suite_function',
            nameToRun: 'workspace/test_folder/test_file.py::test_suite::test_suite_function',
            time: 0
        };

        testSuite = {
            functions: [testSuiteFunction],
            isInstance: true,
            isUnitTest: true,
            name: 'test_suite',
            nameToRun: 'workspace/test_folder/test_file.py::test_suite',
            suites: [],
            time: 0,
            xmlName: 'workspace.test_folder.test_file.py:test_suite'
        };

        testFunction = {
            name: 'test_function',
            nameToRun: 'workspace/test_folder/test_file.py::test_function',
            time: 0
        };

        testFile = {
            fullPath: 'workspace/test_folder/test_file.py',
            functions: [testFunction],
            name: 'test_file.py',
            nameToRun: 'workspace/test_folder/test_file.py',
            suites: [testSuite],
            time: 0,
            xmlName: 'workspace.test_folder.test_file.py'
        };

        testFolder = {
            folders: [],
            name: 'workspace/test_folder',
            nameToRun: 'workspace/test_folder',
            testFiles: [testFile],
            time: 0
        };
    });

    test('Test folder created into test view item', () => {
        const viewItem: TestTreeItem = createTreeViewItemFrom(undefined, testFolder, undefined);
        expect(viewItem.contextValue).is.equal('Folder');
    });

    test('Test file created into test view item', () => {
        const viewItem: TestTreeItem = createTreeViewItemFrom(undefined, testFile, testFolder);
        expect(viewItem.contextValue).is.equal('File');
    });

    test('Test folder created into test view item', () => {
        const viewItem: TestTreeItem = createTreeViewItemFrom(undefined, testSuite, testFile);
        expect(viewItem.contextValue).is.equal('Suite');
    });

    test('Test folder created into test view item', () => {
        const viewItem: TestTreeItem = createTreeViewItemFrom(undefined, testFunction, testFile);
        expect(viewItem.contextValue).is.equal('Function');
    });

    test('Test folder created into test view item', () => {
        const viewItem: TestTreeItem = createTreeViewItemFrom(undefined, testSuiteFunction, testSuite);
        expect(viewItem.contextValue).is.equal('Function');
    });

    test('Children of test folders are only files.', () => {
        const viewItem: TestTreeItem = createTreeViewItemFrom(undefined, testFolder, undefined);
        const childrenItems: TestTreeItem[] = viewItem.children;
        expect(childrenItems.length).to.be.greaterThan(0);
        childrenItems.forEach((item: TestTreeItem) => {
            expect(item.contextValue).to.equal('File');
        });
    });

    test('Children of test files are only test functions and suites.', () => {
        const viewItem: TestTreeItem = createTreeViewItemFrom(undefined, testFile, undefined);
        const childrenItems: TestTreeItem[] = viewItem.children;
        expect(childrenItems.length).to.be.greaterThan(0);
        childrenItems.forEach((item: TestTreeItem) => {
            expect(item.contextValue).is.oneOf(['Function', 'Suite']);
        });
    });

    test('Children of test suites are only test functions.', () => {
        const viewItem: TestTreeItem = createTreeViewItemFrom(undefined, testSuite, undefined);
        const childrenItems: TestTreeItem[] = viewItem.children;
        expect(childrenItems.length).to.be.greaterThan(0);
        childrenItems.forEach((item: TestTreeItem) => {
            expect(item.contextValue).to.equal('Function');
        });
    });
});
