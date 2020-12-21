// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as path from 'path';
import { instance, mock, verify, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { TreeItemCollapsibleState, Uri } from 'vscode';
import { CommandManager } from '../../../client/common/application/commandManager';
import { WorkspaceService } from '../../../client/common/application/workspace';
import { Commands } from '../../../client/common/constants';
import { IDisposable } from '../../../client/common/types';
import { CommandSource } from '../../../client/testing/common/constants';
import { TestCollectionStorageService } from '../../../client/testing/common/services/storageService';
import { getTestDataItemType } from '../../../client/testing/common/testUtils';
import {
    ITestCollectionStorageService,
    TestFile,
    TestFolder,
    Tests,
    TestStatus,
} from '../../../client/testing/common/types';
import { TestTreeItem } from '../../../client/testing/explorer/testTreeViewItem';
import { TestTreeViewProvider } from '../../../client/testing/explorer/testTreeViewProvider';
import { UnitTestManagementService } from '../../../client/testing/main';
import { TestDataItem, TestDataItemType, TestWorkspaceFolder } from '../../../client/testing/types';
import { noop } from '../../core';
import {
    createMockTestExplorer as createMockTestTreeProvider,
    createMockTestsData,
    getMockTestFile,
    getMockTestFolder,
    getMockTestFunction,
    getMockTestSuite,
} from './explorerTestData';

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

// tslint:disable:max-func-body-length
suite('Unit Tests Test Explorer TestTreeViewProvider', () => {
    suite('Misc', () => {
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
            expect(testTreeProvider).is.not.equal(
                undefined,
                'Could not create a mock test explorer, check the parameters of the test setup.',
            );
            const treeRoot = await testTreeProvider.getChildren();
            expect(treeRoot.length).to.be.greaterThan(
                0,
                'No children returned from default view of the TreeViewProvider.',
            );
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
            const testTreeProvider = createMockTestTreeProvider(
                instance(testStore),
                testsData,
                undefined,
                instance(workspaceService),
            );
            const refreshCap = new TestExplorerCaptureRefresh(testTreeProvider, disposables);

            testTreeProvider.refresh(testResource);
            const originalTreeItem = (await testTreeProvider.getTreeItem(changeItem)) as TestTreeItem;
            const origStatus = originalTreeItem.testStatus;

            changeItem.status = TestStatus.Fail;
            testTreeProvider.refresh(testResource);
            const changedTreeItem = (await testTreeProvider.getTreeItem(changeItem)) as TestTreeItem;
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
            const testView = createMockTestTreeProvider(
                instance(testStore),
                testsData,
                undefined,
                instance(workspaceService),
            );

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
            testStoreMoq.setup((a) => a.getTests(typemoq.It.isAny())).returns(() => testData);

            const testTreeProvider = createMockTestTreeProvider(testStoreMoq.object);

            testTreeProvider.refresh(testResource);
            let unchangedItem = await testTreeProvider.getTreeItem(fl1);
            expect(unchangedItem).to.not.be.equal(undefined, 'The file that will always be present, is not present.');

            testData = updatedTestData;
            testTreeProvider.refresh(testResource);

            unchangedItem = await testTreeProvider.getTreeItem(fl1);
            expect(unchangedItem).to.not.be.equal(undefined, 'The file that will always be present, is not present.');
            let addedTreeItem = (await testTreeProvider.getTreeItem(fl2)) as TestTreeItem;
            expect(addedTreeItem).to.not.be.equal(
                undefined,
                'The file has been added to the tests tree but not found?',
            );
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
            addedTreeItem = (await testTreeProvider.getTreeItem(fl2)) as TestTreeItem;
            expect(addedTreeItem).to.not.be.equal(
                undefined,
                'The file has been updated in the tests tree but in tree view?',
            );
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
            testStoreMoq.setup((a) => a.getTests(typemoq.It.isAny())).returns(() => testData);

            const testTreeProvider = createMockTestTreeProvider(testStoreMoq.object);

            testTreeProvider.refresh(testResource);
            let unchangedItem = await testTreeProvider.getTreeItem(suite);
            expect(unchangedItem).to.not.be.equal(undefined, 'The suite that will always be present, is not present.');

            testData = updatedTestData;
            testTreeProvider.refresh(testResource);

            unchangedItem = await testTreeProvider.getTreeItem(suite);
            expect(unchangedItem).to.not.be.equal(undefined, 'The suite that will always be present, is not present.');
            let addedTreeItem = (await testTreeProvider.getTreeItem(suite2)) as TestTreeItem;
            expect(addedTreeItem).to.not.be.equal(
                undefined,
                'The suite has been added to the tests tree but not found?',
            );

            const newName = 'suite_two';
            suite2.name = suite2.name.replace(origName, newName);
            suite2.nameToRun = suite2.nameToRun.replace(origName, newName);
            suite2.xmlName = suite2.xmlName.replace(origName, newName);

            testTreeProvider.refresh(testResource);

            unchangedItem = await testTreeProvider.getTreeItem(suite);
            expect(unchangedItem).to.not.be.equal(undefined, 'The suite that will always be present, is not present.');
            addedTreeItem = (await testTreeProvider.getTreeItem(suite2)) as TestTreeItem;
            expect(addedTreeItem).to.not.be.equal(
                undefined,
                'The suite has been updated in the tests tree but in tree view?',
            );
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
            testStoreMoq.setup((a) => a.getTests(typemoq.It.isAny())).returns(() => testData);

            const testTreeProvider = createMockTestTreeProvider(testStoreMoq.object);

            testTreeProvider.refresh(testResource);
            let unchangedItem = await testTreeProvider.getTreeItem(fn);
            expect(unchangedItem).to.not.be.equal(
                undefined,
                'The function that will always be present, is not present.',
            );

            testData = updatedTestData;
            testTreeProvider.refresh(testResource);

            unchangedItem = await testTreeProvider.getTreeItem(fn);
            expect(unchangedItem).to.not.be.equal(
                undefined,
                'The function that will always be present, is not present.',
            );
            let addedTreeItem = (await testTreeProvider.getTreeItem(fn2)) as TestTreeItem;
            expect(addedTreeItem).to.not.be.equal(
                undefined,
                'The function has been added to the tests tree but not found?',
            );
            expect(addedTreeItem.data.name).to.be.equal('test_fn2');

            const newName = 'test_func_two';
            fn2.name = fn2.name.replace(origName, newName);
            fn2.nameToRun = fn2.nameToRun.replace(origName, newName);

            testTreeProvider.refresh(testResource);

            unchangedItem = await testTreeProvider.getTreeItem(fn);
            expect(unchangedItem).to.not.be.equal(
                undefined,
                'The function that will always be present, is not present.',
            );
            addedTreeItem = (await testTreeProvider.getTreeItem(fn2)) as TestTreeItem;
            expect(addedTreeItem).to.not.be.equal(
                undefined,
                'The function has been updated in the tests tree but in tree view?',
            );
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
            const treeItem = (await testTreeProvider.getTreeItem(testFunction)) as TestTreeItem;
            expect(treeItem.testStatus).to.be.equal(TestStatus.Pass);

            // test's next state is fail
            testFunction.status = TestStatus.Fail;
            testTreeProvider.refresh(testResource);
            let updatedTreeItem = (await testTreeProvider.getTreeItem(testFunction)) as TestTreeItem;
            expect(updatedTreeItem.testStatus).to.be.equal(TestStatus.Fail);

            // test's next state is skip
            testFunction.status = TestStatus.Skipped;
            testTreeProvider.refresh(testResource);
            updatedTreeItem = (await testTreeProvider.getTreeItem(testFunction)) as TestTreeItem;
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
            expect(parent.name).to.be.equal(
                testSuite.name,
                'Function within a test suite not returning the suite as parent.',
            );
            let parentType = getTestDataItemType(parent);
            expect(parentType).to.be.equal(TestDataItemType.suite);

            parent = (await testTreeProvider.getParent(testSuite))!;
            expect(parent.name).to.be.equal(
                testFile.name,
                'Suite within a test file not returning the test file as parent.',
            );
            parentType = getTestDataItemType(parent);
            expect(parentType).to.be.equal(TestDataItemType.file);

            parent = (await testTreeProvider.getParent(outerTestFunction))!;
            expect(parent.name).to.be.equal(
                testFile.name,
                'Function within a test file not returning the test file as parent.',
            );
            parentType = getTestDataItemType(parent);
            expect(parentType).to.be.equal(TestDataItemType.file);

            parent = (await testTreeProvider.getParent(testFile))!;
            parentType = getTestDataItemType(parent!);
            expect(parentType).to.be.equal(TestDataItemType.folder);
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
                expect(getTestDataItemType(child)).to.be.equal(TestDataItemType.function);
            });

            children = await testTreeProvider.getChildren(outerTestFunction);
            expect(children.length).to.be.equal(0, 'A function should never have children.');

            children = await testTreeProvider.getChildren(testFile);
            expect(children.length).to.be.equal(
                2,
                'A file with one suite and one function should have a total of 2 children.',
            );
            children.forEach((child: TestDataItem) => {
                expect(child.name).oneOf(['test_suite', 'test_outer_fn']);
            });
        });

        test('Tree items for subtests are correct', async () => {
            const resource = Uri.file(__filename);
            // Set up the folder & file.
            const folder = getMockTestFolder('tests');
            const file = getMockTestFile(`${folder.name}/test_file.py`);
            folder.testFiles.push(file);
            // Set up the file-level tests.
            const func1 = getMockTestFunction(`${file.name}::test_spam`);
            file.functions.push(func1);
            const func2 = getMockTestFunction(`${file.name}::test_ham[1-2]`);
            func2.subtestParent = {
                name: 'test_ham',
                nameToRun: `${file.name}::test_ham`,
                asSuite: {
                    resource: resource,
                    name: 'test_ham',
                    nameToRun: `${file.name}::test_ham`,
                    functions: [func2],
                    suites: [],
                    isUnitTest: false,
                    isInstance: false,
                    xmlName: 'test_ham',
                    time: 0,
                },
                time: 0,
            };
            file.functions.push(func2);
            const func3 = getMockTestFunction(`${file.name}::test_ham[3-4]`);
            func3.subtestParent = func2.subtestParent;
            func3.subtestParent.asSuite.functions.push(func3);
            file.functions.push(func3);
            // Set up the suite.
            const suite = getMockTestSuite(`${file.name}::MyTests`);
            file.suites.push(suite);
            const func4 = getMockTestFunction('MyTests::test_foo');
            suite.functions.push(func4);
            const func5 = getMockTestFunction('MyTests::test_bar[2-3]');
            func5.subtestParent = {
                name: 'test_bar',
                nameToRun: `${file.name}::MyTests::test_bar`,
                asSuite: {
                    resource: resource,
                    name: 'test_bar',
                    nameToRun: `${file.name}::MyTests::test_bar`,
                    functions: [func5],
                    suites: [],
                    isUnitTest: false,
                    isInstance: false,
                    xmlName: 'test_bar',
                    time: 0,
                },
                time: 0,
            };
            suite.functions.push(func5);
            // Set up the tests data.
            const testData = createMockTestsData([file]);

            const testExplorer = createMockTestTreeProvider(undefined, testData);
            const items = [
                await testExplorer.getTreeItem(func1),
                await testExplorer.getTreeItem(func2),
                await testExplorer.getTreeItem(func3),
                await testExplorer.getTreeItem(func4),
                await testExplorer.getTreeItem(func5),
                await testExplorer.getTreeItem(file),
                await testExplorer.getTreeItem(suite),
                await testExplorer.getTreeItem(func2.subtestParent.asSuite),
                await testExplorer.getTreeItem(func5.subtestParent.asSuite),
            ];

            expect(items).to.deep.equal([
                new TestTreeItem(func1.resource, func1),
                new TestTreeItem(func2.resource, func2),
                new TestTreeItem(func3.resource, func3),
                new TestTreeItem(func4.resource, func4),
                new TestTreeItem(func5.resource, func5),
                new TestTreeItem(file.resource, file),
                new TestTreeItem(suite.resource, suite),
                new TestTreeItem(resource, func2.subtestParent.asSuite),
                new TestTreeItem(resource, func5.subtestParent.asSuite),
            ]);
        });

        test('Parents for subtests are correct', async () => {
            const resource = Uri.file(__filename);
            // Set up the folder & file.
            const folder = getMockTestFolder('tests');
            const file = getMockTestFile(`${folder.name}/test_file.py`);
            folder.testFiles.push(file);
            // Set up the file-level tests.
            const func1 = getMockTestFunction(`${file.name}::test_spam`);
            file.functions.push(func1);
            const func2 = getMockTestFunction(`${file.name}::test_ham[1-2]`);
            func2.subtestParent = {
                name: 'test_ham',
                nameToRun: `${file.name}::test_ham`,
                asSuite: {
                    resource: resource,
                    name: 'test_ham',
                    nameToRun: `${file.name}::test_ham`,
                    functions: [func2],
                    suites: [],
                    isUnitTest: false,
                    isInstance: false,
                    xmlName: 'test_ham',
                    time: 0,
                },
                time: 0,
            };
            file.functions.push(func2);
            const func3 = getMockTestFunction(`${file.name}::test_ham[3-4]`);
            func3.subtestParent = func2.subtestParent;
            func3.subtestParent.asSuite.functions.push(func3);
            file.functions.push(func3);
            // Set up the suite.
            const suite = getMockTestSuite(`${file.name}::MyTests`);
            file.suites.push(suite);
            const func4 = getMockTestFunction('MyTests::test_foo');
            suite.functions.push(func4);
            const func5 = getMockTestFunction('MyTests::test_bar[2-3]');
            func5.subtestParent = {
                name: 'test_bar',
                nameToRun: `${file.name}::MyTests::test_bar`,
                asSuite: {
                    resource: resource,
                    name: 'test_bar',
                    nameToRun: `${file.name}::MyTests::test_bar`,
                    functions: [func5],
                    suites: [],
                    isUnitTest: false,
                    isInstance: false,
                    xmlName: 'test_bar',
                    time: 0,
                },
                time: 0,
            };
            suite.functions.push(func5);
            // Set up the tests data.
            const testData = createMockTestsData([file]);

            const testExplorer = createMockTestTreeProvider(undefined, testData);
            const parents = [
                await testExplorer.getParent(func1),
                await testExplorer.getParent(func2),
                await testExplorer.getParent(func3),
                await testExplorer.getParent(func4),
                await testExplorer.getParent(func5),
                await testExplorer.getParent(suite),
                await testExplorer.getParent(func2.subtestParent.asSuite),
                await testExplorer.getParent(func3.subtestParent.asSuite),
                await testExplorer.getParent(func5.subtestParent.asSuite),
            ];

            expect(parents).to.deep.equal([
                file,
                func2.subtestParent.asSuite,
                func3.subtestParent.asSuite,
                suite,
                func5.subtestParent.asSuite,
                file,
                file,
                file,
                suite,
            ]);
        });
        test('Children for subtests are correct', async () => {
            const resource = Uri.file(__filename);
            // Set up the folder & file.
            const folder = getMockTestFolder('tests');
            const file = getMockTestFile(`${folder.name}/test_file.py`);
            folder.testFiles.push(file);
            // Set up the file-level tests.
            const func1 = getMockTestFunction(`${file.name}::test_spam`);
            file.functions.push(func1);
            const func2 = getMockTestFunction(`${file.name}::test_ham[1-2]`);
            func2.subtestParent = {
                name: 'test_ham',
                nameToRun: `${file.name}::test_ham`,
                asSuite: {
                    resource: resource,
                    name: 'test_ham',
                    nameToRun: `${file.name}::test_ham`,
                    functions: [func2],
                    suites: [],
                    isUnitTest: false,
                    isInstance: false,
                    xmlName: 'test_ham',
                    time: 0,
                },
                time: 0,
            };
            file.functions.push(func2);
            const func3 = getMockTestFunction(`${file.name}::test_ham[3-4]`);
            func3.subtestParent = func2.subtestParent;
            func3.subtestParent.asSuite.functions.push(func3);
            file.functions.push(func3);
            // Set up the suite.
            const suite = getMockTestSuite(`${file.name}::MyTests`);
            file.suites.push(suite);
            const func4 = getMockTestFunction('MyTests::test_foo');
            suite.functions.push(func4);
            const func5 = getMockTestFunction('MyTests::test_bar[2-3]');
            func5.subtestParent = {
                name: 'test_bar',
                nameToRun: `${file.name}::MyTests::test_bar`,
                asSuite: {
                    resource: resource,
                    name: 'test_bar',
                    nameToRun: `${file.name}::MyTests::test_bar`,
                    functions: [func5],
                    suites: [],
                    isUnitTest: false,
                    isInstance: false,
                    xmlName: 'test_bar',
                    time: 0,
                },
                time: 0,
            };
            suite.functions.push(func5);
            // Set up the tests data.
            const testData = createMockTestsData([file]);

            const testExplorer = createMockTestTreeProvider(undefined, testData);
            const childrens = [
                await testExplorer.getChildren(func1),
                await testExplorer.getChildren(func2),
                await testExplorer.getChildren(func3),
                await testExplorer.getChildren(func4),
                await testExplorer.getChildren(func5),
                await testExplorer.getChildren(file),
                await testExplorer.getChildren(suite),
                await testExplorer.getChildren(func2.subtestParent.asSuite),
                await testExplorer.getChildren(func3.subtestParent.asSuite),
                await testExplorer.getChildren(func5.subtestParent.asSuite),
            ];

            expect(childrens).to.deep.equal([
                [],
                [],
                [],
                [],
                [],
                [func1, suite, func2.subtestParent.asSuite],
                [func4, func5.subtestParent.asSuite],
                [func2, func3],
                [func2, func3],
                [func5],
            ]);
            test('Get children will discover only once', async () => {
                const commandManager = mock(CommandManager);
                const testStore = mock(TestCollectionStorageService);
                const testWorkspaceFolder = new TestWorkspaceFolder({ uri: Uri.file(__filename), name: '', index: 0 });
                when(testStore.getTests(testWorkspaceFolder.workspaceFolder.uri)).thenReturn();
                when(testStore.onDidChange).thenReturn(noop as any);

                const testTreeProvider = createMockTestTreeProvider(
                    instance(testStore),
                    undefined,
                    undefined,
                    undefined,
                    instance(commandManager),
                );

                let tests = await testTreeProvider.getChildren(testWorkspaceFolder);

                expect(tests).to.be.lengthOf(0);
                verify(
                    commandManager.executeCommand(
                        Commands.Tests_Discover,
                        testWorkspaceFolder,
                        CommandSource.testExplorer,
                        undefined,
                    ),
                ).once();

                tests = await testTreeProvider.getChildren(testWorkspaceFolder);
                expect(tests).to.be.lengthOf(0);
                verify(
                    commandManager.executeCommand(
                        Commands.Tests_Discover,
                        testWorkspaceFolder,
                        CommandSource.testExplorer,
                        undefined,
                    ),
                ).once();
            });
        });
        test('Expand tree item if it does not have any parent', async () => {
            const commandManager = mock(CommandManager);
            const testStore = mock(TestCollectionStorageService);
            const testWorkspaceFolder = new TestWorkspaceFolder({ uri: Uri.file(__filename), name: '', index: 0 });
            when(testStore.getTests(testWorkspaceFolder.workspaceFolder.uri)).thenReturn();
            when(testStore.onDidChange).thenReturn(noop as any);
            const testTreeProvider = createMockTestTreeProvider(
                instance(testStore),
                undefined,
                undefined,
                undefined,
                instance(commandManager),
            );

            // No parent
            testTreeProvider.getParent = () => Promise.resolve(undefined);

            const element: TestFile = {
                fullPath: __filename,
                functions: [],
                suites: [],
                name: 'name',
                time: 0,
                resource: Uri.file(__filename),
                xmlName: '',
                nameToRun: '',
            };

            const node = await testTreeProvider.getTreeItem(element);

            expect(node.collapsibleState).to.equal(TreeItemCollapsibleState.Expanded);
        });
        test('Expand tree item if the parent is the Workspace Folder in a multiroot scenario', async () => {
            const commandManager = mock(CommandManager);
            const testStore = mock(TestCollectionStorageService);
            const testWorkspaceFolder = new TestWorkspaceFolder({ uri: Uri.file(__filename), name: '', index: 0 });
            when(testStore.getTests(testWorkspaceFolder.workspaceFolder.uri)).thenReturn();
            when(testStore.onDidChange).thenReturn(noop as any);
            const testTreeProvider = createMockTestTreeProvider(
                instance(testStore),
                undefined,
                undefined,
                undefined,
                instance(commandManager),
            );

            // Has a workspace folder as parent.
            const parentFolder = new TestWorkspaceFolder({ name: '', index: 0, uri: Uri.file(__filename) });

            testTreeProvider.getParent = () => Promise.resolve(parentFolder);

            const element: TestFile = {
                fullPath: __filename,
                functions: [],
                suites: [],
                name: 'name',
                time: 0,
                resource: Uri.file(__filename),
                xmlName: '',
                nameToRun: '',
            };

            const node = await testTreeProvider.getTreeItem(element);

            expect(node.collapsibleState).to.equal(TreeItemCollapsibleState.Expanded);
        });
        test('Do not expand tree item if it does not have any parent', async () => {
            const commandManager = mock(CommandManager);
            const testStore = mock(TestCollectionStorageService);
            const testWorkspaceFolder = new TestWorkspaceFolder({ uri: Uri.file(__filename), name: '', index: 0 });
            when(testStore.getTests(testWorkspaceFolder.workspaceFolder.uri)).thenReturn();
            when(testStore.onDidChange).thenReturn(noop as any);
            const testTreeProvider = createMockTestTreeProvider(
                instance(testStore),
                undefined,
                undefined,
                undefined,
                instance(commandManager),
            );

            // Has a parent folder
            const parentFolder: TestFolder = {
                name: '',
                nameToRun: '',
                resource: Uri.file(__filename),
                time: 0,
                testFiles: [],
                folders: [],
            };

            testTreeProvider.getParent = () => Promise.resolve(parentFolder);

            const element: TestFile = {
                fullPath: __filename,
                functions: [],
                suites: [],
                name: 'name',
                time: 0,
                resource: Uri.file(__filename),
                xmlName: '',
                nameToRun: '',
            };

            const node = await testTreeProvider.getTreeItem(element);

            expect(node.collapsibleState).to.not.equal(TreeItemCollapsibleState.Expanded);
        });
    });
    suite('Root Nodes', () => {
        let treeProvider: TestTreeViewProvider;
        setup(() => {
            const store = mock(TestCollectionStorageService);
            const managementService = mock(UnitTestManagementService);
            when(managementService.onDidStatusChange).thenReturn(noop as any);
            when(store.onDidChange).thenReturn(noop as any);
            const workspace = mock(WorkspaceService);
            when(workspace.onDidChangeWorkspaceFolders).thenReturn(noop as any);
            const commandManager = mock(CommandManager);
            treeProvider = new TestTreeViewProvider(
                instance(store),
                instance(managementService),
                instance(workspace),
                instance(commandManager),
                [],
            );
        });
        test('The root folder will not be displayed if there are no tests', async () => {
            const children = treeProvider.getRootNodes();

            expect(children).to.deep.equal([]);
        });
        test('The root folder will not be displayed if there are no test files directly under the root', async () => {
            const folder1: TestFolder = {
                folders: [],
                name: 'child',
                nameToRun: 'child',
                testFiles: [],
                time: 0,
                resource: Uri.file(__filename),
            };
            const tests: Tests = {
                rootTestFolders: [folder1],
                summary: { errors: 0, skipped: 0, passed: 0, failures: 0 },
                testFiles: [],
                testFunctions: [],
                testFolders: [],
                testSuites: [],
            };
            const children = treeProvider.getRootNodes(tests);

            expect(children).to.deep.equal([]);
        });
        test('Files & folders under root folder are returned as children', async () => {
            const rootFolderPath = path.join('a', 'b', 'root');
            const child1FolderPath = path.join('a', 'b', 'root', 'child1');
            const child2FolderPath = path.join('a', 'b', 'root', 'child2');
            const file1: TestFile = {
                fullPath: path.join(rootFolderPath, 'file1'),
                functions: [],
                name: 'file',
                nameToRun: 'file',
                resource: Uri.file('file'),
                suites: [],
                time: 0,
                xmlName: 'file',
            };
            const file2: TestFile = {
                fullPath: path.join(rootFolderPath, 'file2'),
                functions: [],
                name: 'file2',
                nameToRun: 'file2',
                resource: Uri.file('file2'),
                suites: [],
                time: 0,
                xmlName: 'file2',
            };
            const file3: TestFile = {
                fullPath: path.join(child1FolderPath, 'file1'),
                functions: [],
                name: 'file3',
                nameToRun: 'file3',
                resource: Uri.file('file3'),
                suites: [],
                time: 0,
                xmlName: 'file3',
            };
            const child2Folder: TestFolder = {
                folders: [],
                name: child2FolderPath,
                nameToRun: 'child3',
                testFiles: [],
                time: 0,
                resource: Uri.file(__filename),
            };
            const child1Folder: TestFolder = {
                folders: [child2Folder],
                name: child1FolderPath,
                nameToRun: 'child2',
                testFiles: [file3],
                time: 0,
                resource: Uri.file(__filename),
            };
            const rootFolder: TestFolder = {
                folders: [child1Folder],
                name: rootFolderPath,
                nameToRun: 'child',
                testFiles: [file1, file2],
                time: 0,
                resource: Uri.file(__filename),
            };
            const tests: Tests = {
                rootTestFolders: [rootFolder],
                summary: { errors: 0, skipped: 0, passed: 0, failures: 0 },
                testFiles: [file1, file2, file3],
                testFunctions: [],
                testFolders: [rootFolder, child1Folder, child2Folder],
                testSuites: [],
            };
            const children = treeProvider.getRootNodes(tests);

            expect(children).to.be.lengthOf(3);
            expect(children).to.deep.equal([file1, file2, child1Folder]);
        });
        test('Root folders are returned as children', async () => {
            const child1FolderPath = path.join('a', 'b', 'root1', 'child1');
            const child2FolderPath = path.join('a', 'b', 'root1', 'child1', 'child2');
            const child3FolderPath = path.join('a', 'b', 'root2', 'child3');
            const file1: TestFile = {
                fullPath: path.join(child3FolderPath, 'file1'),
                functions: [],
                name: 'file',
                nameToRun: 'file',
                resource: Uri.file('file'),
                suites: [],
                time: 0,
                xmlName: 'file',
            };
            const file2: TestFile = {
                fullPath: path.join(child3FolderPath, 'file2'),
                functions: [],
                name: 'file2',
                nameToRun: 'file2',
                resource: Uri.file('file2'),
                suites: [],
                time: 0,
                xmlName: 'file2',
            };
            const file3: TestFile = {
                fullPath: path.join(child3FolderPath, 'file3'),
                functions: [],
                name: 'file3',
                nameToRun: 'file3',
                resource: Uri.file('file3'),
                suites: [],
                time: 0,
                xmlName: 'file3',
            };
            const child2Folder: TestFolder = {
                folders: [],
                name: child2FolderPath,
                nameToRun: 'child3',
                testFiles: [file2],
                time: 0,
                resource: Uri.file(__filename),
            };
            const child1Folder: TestFolder = {
                folders: [child2Folder],
                name: child1FolderPath,
                nameToRun: 'child2',
                testFiles: [file1],
                time: 0,
                resource: Uri.file(__filename),
            };
            const child3Folder: TestFolder = {
                folders: [],
                name: child3FolderPath,
                nameToRun: 'child',
                testFiles: [file3],
                time: 0,
                resource: Uri.file(__filename),
            };
            const tests: Tests = {
                rootTestFolders: [child1Folder, child3Folder],
                summary: { errors: 0, skipped: 0, passed: 0, failures: 0 },
                testFiles: [file1, file2, file3],
                testFunctions: [],
                testFolders: [child3Folder, child1Folder, child2Folder],
                testSuites: [],
            };
            const children = treeProvider.getRootNodes(tests);

            expect(children).to.be.lengthOf(2);
            expect(children).to.deep.equal([child1Folder, child3Folder]);
        });
    });
});
