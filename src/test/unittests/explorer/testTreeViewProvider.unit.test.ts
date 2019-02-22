// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as typemoq from 'typemoq';
import { Uri } from 'vscode';
import { IDisposable } from '../../../client/common/types';
import { getTestType } from '../../../client/unittests/common/testUtils';
import { ITestCollectionStorageService, TestStatus, TestType } from '../../../client/unittests/common/types';
import { TestTreeViewProvider } from '../../../client/unittests/explorer/testTreeViewProvider';
import { TestDataItem } from '../../../client/unittests/types';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../constants';
import { createMockTestExplorer, createMockTestsData, getMockTestFile, getMockTestFunction, getMockTestSuite } from './explorerTestData';

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
    const testResource: Uri = Uri.parse(EXTENSION_ROOT_DIR_FOR_TESTS);
    let disposables: IDisposable[] = [];

    teardown(() => {
        disposables.forEach((disposableItem: IDisposable) => {
            disposableItem.dispose();
        });
        disposables = [];
    });

    test('Create the initial view and ensure it provides a default view', async () => {
        const testExplorer = createMockTestExplorer();
        expect(testExplorer).is.not.equal(undefined, 'Could not create a mock test explorer, check the parameters of the test setup.');
        const treeRoot = testExplorer.getChildren();
        expect(treeRoot.length).to.be.greaterThan(0, 'No children returned from default view of the TreeViewProvider.');
    });

    test('Ensure that updates from the test manager propagate to the TestExplorer', async () => {
        const testsData = createMockTestsData();
        const changeItem = testsData.testFolders[1].testFiles[0].functions[0];
        const testExplorer = createMockTestExplorer(undefined, testsData);
        const refreshCap = new TestExplorerCaptureRefresh(testExplorer, disposables);

        testExplorer.refresh(testResource);
        const originalTreeItem = await testExplorer.getTreeItem(changeItem);
        const origStatus = originalTreeItem.testStatus;

        changeItem.status = TestStatus.Fail;
        testExplorer.refresh(testResource);
        const changedTreeItem = await testExplorer.getTreeItem(changeItem);
        const updatedStatus = changedTreeItem.testStatus;

        expect(origStatus).to.not.equal(updatedStatus);
        expect(refreshCap.refreshCount).to.equal(2);
    });

    test('When the test data is updated, the update event is emitted', () => {
        const testView = createMockTestExplorer();
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

        const testExplorer = createMockTestExplorer(testStoreMoq.object);

        testExplorer.refresh(testResource);
        let unchangedItem = await testExplorer.getTreeItem(fl1);
        expect(unchangedItem).to.not.be.equal(undefined, 'The file that will always be present, is not present.');

        testData = updatedTestData;
        testExplorer.refresh(testResource);

        unchangedItem = await testExplorer.getTreeItem(fl1);
        expect(unchangedItem).to.not.be.equal(undefined, 'The file that will always be present, is not present.');
        let addedTreeItem = await testExplorer.getTreeItem(fl2);
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

        testExplorer.refresh(testResource);

        unchangedItem = await testExplorer.getTreeItem(fl1);
        expect(unchangedItem).to.not.be.equal(undefined, 'The file that will always be present, is not present.');
        addedTreeItem = await testExplorer.getTreeItem(fl2);
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

        const testExplorer = createMockTestExplorer(testStoreMoq.object);

        testExplorer.refresh(testResource);
        let unchangedItem = await testExplorer.getTreeItem(suite);
        expect(unchangedItem).to.not.be.equal(undefined, 'The suite that will always be present, is not present.');

        testData = updatedTestData;
        testExplorer.refresh(testResource);

        unchangedItem = await testExplorer.getTreeItem(suite);
        expect(unchangedItem).to.not.be.equal(undefined, 'The suite that will always be present, is not present.');
        let addedTreeItem = await testExplorer.getTreeItem(suite2);
        expect(addedTreeItem).to.not.be.equal(undefined, 'The suite has been added to the tests tree but not found?');

        const newName = 'suite_two';
        suite2.name = suite2.name.replace(origName, newName);
        suite2.nameToRun = suite2.nameToRun.replace(origName, newName);
        suite2.xmlName = suite2.xmlName.replace(origName, newName);

        testExplorer.refresh(testResource);

        unchangedItem = await testExplorer.getTreeItem(suite);
        expect(unchangedItem).to.not.be.equal(undefined, 'The suite that will always be present, is not present.');
        addedTreeItem = await testExplorer.getTreeItem(suite2);
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

        const testExplorer = createMockTestExplorer(testStoreMoq.object);

        testExplorer.refresh(testResource);
        let unchangedItem = await testExplorer.getTreeItem(fn);
        expect(unchangedItem).to.not.be.equal(undefined, 'The function that will always be present, is not present.');

        testData = updatedTestData;
        testExplorer.refresh(testResource);

        unchangedItem = await testExplorer.getTreeItem(fn);
        expect(unchangedItem).to.not.be.equal(undefined, 'The function that will always be present, is not present.');
        let addedTreeItem = await testExplorer.getTreeItem(fn2);
        expect(addedTreeItem).to.not.be.equal(undefined, 'The function has been added to the tests tree but not found?');
        expect(addedTreeItem.data.name).to.be.equal('test_fn2');

        const newName = 'test_func_two';
        fn2.name = fn2.name.replace(origName, newName);
        fn2.nameToRun = fn2.nameToRun.replace(origName, newName);

        testExplorer.refresh(testResource);

        unchangedItem = await testExplorer.getTreeItem(fn);
        expect(unchangedItem).to.not.be.equal(undefined, 'The function that will always be present, is not present.');
        addedTreeItem = await testExplorer.getTreeItem(fn2);
        expect(addedTreeItem).to.not.be.equal(undefined, 'The function has been updated in the tests tree but in tree view?');
        expect(addedTreeItem.data.name).to.be.equal(newName);
    });

    test('A test status changes and is reflected in the tree view', async () => {
        // create a single file with a single function
        const testFunction = getMockTestFunction('test/test_file.py::test_fn');
        testFunction.status = TestStatus.Pass;
        const testFile = getMockTestFile('test/test_file.py', [], [testFunction]);
        const testData = createMockTestsData([testFile]);

        const testExplorer = createMockTestExplorer(undefined, testData);

        // test's initial state is success
        testExplorer.refresh(testResource);
        const treeItem = await testExplorer.getTreeItem(testFunction);
        expect(treeItem.testStatus).to.be.equal(TestStatus.Pass);

        // test's next state is fail
        testFunction.status = TestStatus.Fail;
        testExplorer.refresh(testResource);
        let updatedTreeItem = await testExplorer.getTreeItem(testFunction);
        expect(updatedTreeItem.testStatus).to.be.equal(TestStatus.Fail);

        // test's next state is skip
        testFunction.status = TestStatus.Skipped;
        testExplorer.refresh(testResource);
        updatedTreeItem = await testExplorer.getTreeItem(testFunction);
        expect(updatedTreeItem.testStatus).to.be.equal(TestStatus.Skipped);
    });

    test('Get parent is working for each item type', async () => {
        // create a single folder/file/suite/test setup
        const testFunction = getMockTestFunction('test/test_file.py::test_suite::test_fn');
        const testSuite = getMockTestSuite('test/test_file.py::test_suite', [testFunction]);
        const outerTestFunction = getMockTestFunction('test/test_file.py::test_outer_fn');
        const testFile = getMockTestFile('test/test_file.py', [testSuite], [outerTestFunction]);
        const testData = createMockTestsData([testFile]);

        const testExplorer = createMockTestExplorer(undefined, testData);

        // build up the view item tree
        testExplorer.refresh(testResource);

        let parent = await testExplorer.getParent!(testFunction)!;
        expect(parent.name).to.be.equal(testSuite.name, 'Function within a test suite not returning the suite as parent.');
        let parentType = getTestType(parent);
        expect(parentType).to.be.equal(TestType.testSuite);

        parent = await testExplorer.getParent!(testSuite)!;
        expect(parent.name).to.be.equal(testFile.name, 'Suite within a test file not returning the test file as parent.');
        parentType = getTestType(parent);
        expect(parentType).to.be.equal(TestType.testFile);

        parent = await testExplorer.getParent!(outerTestFunction)!;
        expect(parent.name).to.be.equal(testFile.name, 'Function within a test file not returning the test file as parent.');
        parentType = getTestType(parent);
        expect(parentType).to.be.equal(TestType.testFile);

        parent = await testExplorer.getParent!(testFile)!;
        parentType = getTestType(parent);
        expect(parentType).to.be.equal(TestType.testFolder);
    });

    test('Get children is working for each item type', async () => {
        // create a single folder/file/suite/test setup
        const testFunction = getMockTestFunction('test/test_file.py::test_suite::test_fn');
        const testSuite = getMockTestSuite('test/test_file.py::test_suite', [testFunction]);
        const outerTestFunction = getMockTestFunction('test/test_file.py::test_outer_fn');
        const testFile = getMockTestFile('test/test_file.py', [testSuite], [outerTestFunction]);
        const testData = createMockTestsData([testFile]);

        const testExplorer = createMockTestExplorer(undefined, testData);

        // build up the view item tree
        testExplorer.refresh(testResource);

        let children = testExplorer.getChildren(testFunction);
        expect(children.length).to.be.equal(0, 'A function should never have children.');

        children = testExplorer.getChildren(testSuite);
        expect(children.length).to.be.equal(1, 'Suite a single function should only return one child.');
        children.forEach((child: TestDataItem) => {
            expect(child.name).oneOf(['test_fn']);
            expect(getTestType(child)).to.be.equal(TestType.testFunction);
        });

        children = testExplorer.getChildren(outerTestFunction);
        expect(children.length).to.be.equal(0, 'A function should never have children.');

        children = testExplorer.getChildren(testFile);
        expect(children.length).to.be.equal(2, 'A file with one suite and one function should have a total of 2 children.');
        children.forEach((child: TestDataItem) => {
            expect(child.name).oneOf(['test_suite', 'test_outer_fn']);
        });
    });
});
