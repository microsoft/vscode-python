// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { instance, mock, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { Uri } from 'vscode';
import { WorkspaceService } from '../../../client/common/application/workspace';
import { IDisposable } from '../../../client/common/types';
import { TestCollectionStorageService } from '../../../client/unittests/common/services/storageService';
import { getTestType } from '../../../client/unittests/common/testUtils';
import { ITestCollectionStorageService, TestStatus, TestType } from '../../../client/unittests/common/types';
import { TestTreeItem } from '../../../client/unittests/explorer/testTreeViewItem';
import { TestTreeViewProvider } from '../../../client/unittests/explorer/testTreeViewProvider';
import { TestDataItem } from '../../../client/unittests/types';
import { noop } from '../../core';
import { createMockTestExplorer as createMockTestTreeProvider, createMockTestsData, getMockTestFile, getMockTestFunction, getMockTestSuite } from './explorerTestData';

// tslint:disable:no-any

/**
 * Class that is useful to track any Tree View update requests made by the view provider.
 */
class TestExplorerCaptureRefresh implements IDisposable {
    public refreshCount: number = 0; // this counts the number of times 'onDidChangeTreeData' is emitted.

    private disposable: IDisposable;

    constructor(private testViewProvider: TestTreeViewProvider, disposableContainer: IDisposable[]) {
        this.disposable = this.testViewProvider.onDidChangeTreeData(this.onRefreshOcured.bind(this));
        disposableContainer.push(this);
    }

    public dispose() {
        this.disposable.dispose();
    }

    private onRefreshOcured(_testDataItem?: TestDataItem): void {
        this.refreshCount = this.refreshCount + 1;
    }
}

// tslint:disable-next-line:max-func-body-length
suite('Unit Tests Test Explorer TestTreeViewProvider', () => {
    const testResource: Uri = Uri.parse('anything');
    let disposables: IDisposable[] = [];

    teardown(() => {
        disposables.forEach((disposableItem: IDisposable) => {
            disposableItem.dispose();
        });
        disposables = [];
    });

    test('Create the initial view and ensure it provides a default view', async () => {
        const testTreeProvider = createMockTestTreeProvider();
        expect(testTreeProvider).is.not.equal(undefined, 'Could not create a mock test explorer, check the parameters of the test setup.');
        const treeRoot = await testTreeProvider.getChildren();
        expect(treeRoot.length).to.be.greaterThan(0, 'No children returned from default view of the TreeViewProvider.');
    });

    test('Ensure that updates from the test manager propagate to the TestExplorer', async () => {
        const testsData = createMockTestsData();
        const workspaceService = mock(WorkspaceService);
        const testStore = mock(TestCollectionStorageService);
        const workspaceFolder = { uri: Uri.file(''), name: 'root', index: 0 };
        when(workspaceService.getWorkspaceFolder(testResource)).thenReturn(workspaceFolder);
        when(workspaceService.onDidChangeWorkspaceFolders).thenReturn(noop as any);
        when(testStore.getTests(testResource)).thenReturn(testsData);
        when(testStore.onDidChange).thenReturn(noop as any);
        const changeItem = testsData.testFolders[1].testFiles[0].functions[0];
        const testTreeProvider = createMockTestTreeProvider(instance(testStore), testsData, undefined, instance(workspaceService));
        const refreshCap = new TestExplorerCaptureRefresh(testTreeProvider, disposables);

        testTreeProvider.refresh(testResource);
        const originalTreeItem = await testTreeProvider.getTreeItem(changeItem) as TestTreeItem;
        const origStatus = originalTreeItem.testStatus;

        changeItem.status = TestStatus.Fail;
        testTreeProvider.refresh(testResource);
        const changedTreeItem = await testTreeProvider.getTreeItem(changeItem) as TestTreeItem;
        const updatedStatus = changedTreeItem.testStatus;

        expect(origStatus).to.not.equal(updatedStatus);
        expect(refreshCap.refreshCount).to.equal(2);
    });

    test('When the test data is updated, the update event is emitted', () => {
        const testsData = createMockTestsData();
        const workspaceService = mock(WorkspaceService);
        const testStore = mock(TestCollectionStorageService);
        const workspaceFolder = { uri: Uri.file(''), name: 'root', index: 0 };
        when(workspaceService.getWorkspaceFolder(testResource)).thenReturn(workspaceFolder);
        when(workspaceService.onDidChangeWorkspaceFolders).thenReturn(noop as any);
        when(testStore.getTests(testResource)).thenReturn(testsData);
        when(testStore.onDidChange).thenReturn(noop as any);
        const testView = createMockTestTreeProvider(instance(testStore), testsData, undefined, instance(workspaceService));

        const refreshCap = new TestExplorerCaptureRefresh(testView, disposables);
        testView.refresh(testResource);

        expect(refreshCap.refreshCount).to.be.equal(1);
    });

    test('A test file is added/removed/renamed', async () => {
        // create an inital test tree with a single file.
        const fn = getMockTestFunction('test/test_fl.py::test_fn1');
        const fl1 = getMockTestFile('test/test_fl.py', [], [fn]);
        const originalTestData = createMockTestsData([fl1]);

        // create an updated test tree, similar to the first, but with a new file
        const origName = 'test_fl2';
        const afn = getMockTestFunction(`test/${origName}.py::test_2fn1`);
        const fl2 = getMockTestFile(`test/${origName}.py`, [], [afn]);
        const updatedTestData = createMockTestsData([fl1, fl2]);

        let testData = originalTestData;
        const testStoreMoq = typemoq.Mock.ofType<ITestCollectionStorageService>();
        testStoreMoq.setup(a => a.getTests(typemoq.It.isAny())).returns(() => testData);

        const testTreeProvider = createMockTestTreeProvider(testStoreMoq.object);

        testTreeProvider.refresh(testResource);
        let unchangedItem = await testTreeProvider.getTreeItem(fl1);
        expect(unchangedItem).to.not.be.equal(undefined, 'The file that will always be present, is not present.');

        testData = updatedTestData;
        testTreeProvider.refresh(testResource);

        unchangedItem = await testTreeProvider.getTreeItem(fl1);
        expect(unchangedItem).to.not.be.equal(undefined, 'The file that will always be present, is not present.');
        let addedTreeItem = await testTreeProvider.getTreeItem(fl2) as TestTreeItem;
        expect(addedTreeItem).to.not.be.equal(undefined, 'The file has been added to the tests tree but not found?');
        expect(addedTreeItem.data.name).to.be.equal(`${origName}.py`);

        // change the name of the added file...
        const newName = 'test_file_two';
        afn.name = afn.name.replace(origName, newName);
        afn.nameToRun = afn.nameToRun.replace(origName, newName);
        fl2.name = fl2.name.replace(origName, newName);
        fl2.fullPath = fl2.fullPath.replace(origName, newName);
        fl2.nameToRun = fl2.nameToRun.replace(origName, newName);
        fl2.xmlName = fl2.xmlName.replace(origName, newName);

        testTreeProvider.refresh(testResource);

        unchangedItem = await testTreeProvider.getTreeItem(fl1);
        expect(unchangedItem).to.not.be.equal(undefined, 'The file that will always be present, is not present.');
        addedTreeItem = await testTreeProvider.getTreeItem(fl2) as TestTreeItem;
        expect(addedTreeItem).to.not.be.equal(undefined, 'The file has been updated in the tests tree but in tree view?');
        expect(addedTreeItem.data.name).to.be.equal(`${newName}.py`);
    });

    test('A test suite is added/removed/renamed', async () => {
        // create an inital test tree with a single file containing a single suite.
        const sfn = getMockTestFunction('test/test_fl.py::suite1::test_fn');
        const suite = getMockTestSuite('test/test_fl.py::suite1', [sfn]);
        const fl1 = getMockTestFile('test/test_fl.py', [suite]);
        const originalTestData = createMockTestsData([fl1]);

        // create an updated test tree, similar to the first, but with a new file
        const origName = 'suite2';
        const sfn2 = getMockTestFunction(`test/test_fl.py::${origName}::test_fn`);
        const suite2 = getMockTestSuite(`test/test_fl.py::${origName}`, [sfn2]);
        const fl1_update = getMockTestFile('test/test_fl.py', [suite, suite2]);
        const updatedTestData = createMockTestsData([fl1_update]);

        let testData = originalTestData;
        const testStoreMoq = typemoq.Mock.ofType<ITestCollectionStorageService>();
        testStoreMoq.setup(a => a.getTests(typemoq.It.isAny())).returns(() => testData);

        const testTreeProvider = createMockTestTreeProvider(testStoreMoq.object);

        testTreeProvider.refresh(testResource);
        let unchangedItem = await testTreeProvider.getTreeItem(suite);
        expect(unchangedItem).to.not.be.equal(undefined, 'The suite that will always be present, is not present.');

        testData = updatedTestData;
        testTreeProvider.refresh(testResource);

        unchangedItem = await testTreeProvider.getTreeItem(suite);
        expect(unchangedItem).to.not.be.equal(undefined, 'The suite that will always be present, is not present.');
        let addedTreeItem = await testTreeProvider.getTreeItem(suite2) as TestTreeItem;
        expect(addedTreeItem).to.not.be.equal(undefined, 'The suite has been added to the tests tree but not found?');

        const newName = 'suite_two';
        suite2.name = suite2.name.replace(origName, newName);
        suite2.nameToRun = suite2.nameToRun.replace(origName, newName);
        suite2.xmlName = suite2.xmlName.replace(origName, newName);

        testTreeProvider.refresh(testResource);

        unchangedItem = await testTreeProvider.getTreeItem(suite);
        expect(unchangedItem).to.not.be.equal(undefined, 'The suite that will always be present, is not present.');
        addedTreeItem = await testTreeProvider.getTreeItem(suite2) as TestTreeItem;
        expect(addedTreeItem).to.not.be.equal(undefined, 'The suite has been updated in the tests tree but in tree view?');
        expect(addedTreeItem.data.name).to.be.equal(newName);
    });

    test('A test function is added/removed/renamed', async () => {
        // create an inital test tree with a single file containing a single suite.
        const fn = getMockTestFunction('test/test_fl.py::test_fn');
        const fl1 = getMockTestFile('test/test_fl.py', [], [fn]);
        const originalTestData = createMockTestsData([fl1]);

        // create an updated test tree, similar to the first, but with a new function
        const origName = 'test_fn2';
        const fn2 = getMockTestFunction(`test/test_fl.py::${origName}`);
        const fl1_update = getMockTestFile('test/test_fl.py', [], [fn, fn2]);
        const updatedTestData = createMockTestsData([fl1_update]);

        let testData = originalTestData;
        const testStoreMoq = typemoq.Mock.ofType<ITestCollectionStorageService>();
        testStoreMoq.setup(a => a.getTests(typemoq.It.isAny())).returns(() => testData);

        const testTreeProvider = createMockTestTreeProvider(testStoreMoq.object);

        testTreeProvider.refresh(testResource);
        let unchangedItem = await testTreeProvider.getTreeItem(fn);
        expect(unchangedItem).to.not.be.equal(undefined, 'The function that will always be present, is not present.');

        testData = updatedTestData;
        testTreeProvider.refresh(testResource);

        unchangedItem = await testTreeProvider.getTreeItem(fn);
        expect(unchangedItem).to.not.be.equal(undefined, 'The function that will always be present, is not present.');
        let addedTreeItem = await testTreeProvider.getTreeItem(fn2) as TestTreeItem;
        expect(addedTreeItem).to.not.be.equal(undefined, 'The function has been added to the tests tree but not found?');
        expect(addedTreeItem.data.name).to.be.equal('test_fn2');

        const newName = 'test_func_two';
        fn2.name = fn2.name.replace(origName, newName);
        fn2.nameToRun = fn2.nameToRun.replace(origName, newName);

        testTreeProvider.refresh(testResource);

        unchangedItem = await testTreeProvider.getTreeItem(fn);
        expect(unchangedItem).to.not.be.equal(undefined, 'The function that will always be present, is not present.');
        addedTreeItem = await testTreeProvider.getTreeItem(fn2) as TestTreeItem;
        expect(addedTreeItem).to.not.be.equal(undefined, 'The function has been updated in the tests tree but in tree view?');
        expect(addedTreeItem.data.name).to.be.equal(newName);
    });

    test('A test status changes and is reflected in the tree view', async () => {
        // create a single file with a single function
        const testFunction = getMockTestFunction('test/test_file.py::test_fn');
        testFunction.status = TestStatus.Pass;
        const testFile = getMockTestFile('test/test_file.py', [], [testFunction]);
        const testData = createMockTestsData([testFile]);

        const testTreeProvider = createMockTestTreeProvider(undefined, testData);

        // test's initial state is success
        testTreeProvider.refresh(testResource);
        const treeItem = await testTreeProvider.getTreeItem(testFunction) as TestTreeItem;
        expect(treeItem.testStatus).to.be.equal(TestStatus.Pass);

        // test's next state is fail
        testFunction.status = TestStatus.Fail;
        testTreeProvider.refresh(testResource);
        let updatedTreeItem = await testTreeProvider.getTreeItem(testFunction) as TestTreeItem;
        expect(updatedTreeItem.testStatus).to.be.equal(TestStatus.Fail);

        // test's next state is skip
        testFunction.status = TestStatus.Skipped;
        testTreeProvider.refresh(testResource);
        updatedTreeItem = await testTreeProvider.getTreeItem(testFunction) as TestTreeItem;
        expect(updatedTreeItem.testStatus).to.be.equal(TestStatus.Skipped);
    });

    test('Get parent is working for each item type', async () => {
        // create a single folder/file/suite/test setup
        const testFunction = getMockTestFunction('test/test_file.py::test_suite::test_fn');
        const testSuite = getMockTestSuite('test/test_file.py::test_suite', [testFunction]);
        const outerTestFunction = getMockTestFunction('test/test_file.py::test_outer_fn');
        const testFile = getMockTestFile('test/test_file.py', [testSuite], [outerTestFunction]);
        const testData = createMockTestsData([testFile]);

        const testTreeProvider = createMockTestTreeProvider(undefined, testData);

        // build up the view item tree
        testTreeProvider.refresh(testResource);

        let parent = (await testTreeProvider.getParent(testFunction))!;
        expect(parent.name).to.be.equal(testSuite.name, 'Function within a test suite not returning the suite as parent.');
        let parentType = getTestType(parent);
        expect(parentType).to.be.equal(TestType.testSuite);

        parent = (await testTreeProvider.getParent(testSuite))!;
        expect(parent.name).to.be.equal(testFile.name, 'Suite within a test file not returning the test file as parent.');
        parentType = getTestType(parent);
        expect(parentType).to.be.equal(TestType.testFile);

        parent = (await testTreeProvider.getParent(outerTestFunction))!;
        expect(parent.name).to.be.equal(testFile.name, 'Function within a test file not returning the test file as parent.');
        parentType = getTestType(parent);
        expect(parentType).to.be.equal(TestType.testFile);

        parent = (await testTreeProvider.getParent(testFile))!;
        parentType = getTestType(parent!);
        expect(parentType).to.be.equal(TestType.testFolder);
    });

    test('Get children is working for each item type', async () => {
        // create a single folder/file/suite/test setup
        const testFunction = getMockTestFunction('test/test_file.py::test_suite::test_fn');
        const testSuite = getMockTestSuite('test/test_file.py::test_suite', [testFunction]);
        const outerTestFunction = getMockTestFunction('test/test_file.py::test_outer_fn');
        const testFile = getMockTestFile('test/test_file.py', [testSuite], [outerTestFunction]);
        const testData = createMockTestsData([testFile]);

        const testTreeProvider = createMockTestTreeProvider(undefined, testData);

        // build up the view item tree
        testTreeProvider.refresh(testResource);

        let children = await testTreeProvider.getChildren(testFunction);
        expect(children.length).to.be.equal(0, 'A function should never have children.');

        children = await testTreeProvider.getChildren(testSuite);
        expect(children.length).to.be.equal(1, 'Suite a single function should only return one child.');
        children.forEach((child: TestDataItem) => {
            expect(child.name).oneOf(['test_fn']);
            expect(getTestType(child)).to.be.equal(TestType.testFunction);
        });

        children = await testTreeProvider.getChildren(outerTestFunction);
        expect(children.length).to.be.equal(0, 'A function should never have children.');

        children = await testTreeProvider.getChildren(testFile);
        expect(children.length).to.be.equal(2, 'A file with one suite and one function should have a total of 2 children.');
        children.forEach((child: TestDataItem) => {
            expect(child.name).oneOf(['test_suite', 'test_outer_fn']);
        });
    });
});
