// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

/**
 * Test utilities for testing the TestViewTreeProvider class.
 */

import { parse as path_parse } from 'path';
import * as typemoq from 'typemoq';
import { Uri, WorkspaceFolder } from 'vscode';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../../../client/common/application/types';
import { IDisposable, IDisposableRegistry } from '../../../client/common/types';
import { IServiceContainer } from '../../../client/ioc/types';
import { TestsHelper } from '../../../client/unittests/common/testUtils';
import { TestFlatteningVisitor } from '../../../client/unittests/common/testVisitors/flatteningVisitor';
import {
    ITestCollectionStorageService, TestFile,
    TestFolder, TestFunction, Tests, TestSuite
} from '../../../client/unittests/common/types';
import {
    TestTreeViewProvider
} from '../../../client/unittests/explorer/testTreeViewProvider';
import { IUnitTestManagementService } from '../../../client/unittests/types';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../constants';

/**
 * Return a basic hierarchy of test data items for use in testing.
 *
 * @returns Array containing the items broken out from the hierarchy (all items are linked to one another)
 */
export function getTestExplorerViewItemData(): [TestFolder, TestFile, TestFunction, TestSuite, TestFunction] {

    let testFolder: TestFolder;
    let testFile: TestFile;
    let testSuite: TestSuite;
    let testFunction: TestFunction;
    let testSuiteFunction: TestFunction;

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
    return [testFolder, testFile, testFunction, testSuite, testSuiteFunction];
}

/**
 * Creates mock `Tests` data suitable for testing the TestTreeViewProvider with.
 */
export function createMockTestsData(): Tests {
    let testFolder: TestFolder;
    let testFile: TestFile;
    let testFunction: TestFunction;
    let testSuite: TestSuite;
    let testSuiteFn: TestFunction;

    [testFolder,
        testFile,
        testFunction,
        testSuite,
        testSuiteFn] = getTestExplorerViewItemData();
    const appShellMoq = typemoq.Mock.ofType<IApplicationShell>();
    const commMgrMoq = typemoq.Mock.ofType<ICommandManager>();
    const serviceContainerMoq = typemoq.Mock.ofType<IServiceContainer>();
    serviceContainerMoq.setup(a => a.get(typemoq.It.isValue(IApplicationShell), typemoq.It.isAny()))
        .returns(() => appShellMoq.object);
    serviceContainerMoq.setup(a => a.get(typemoq.It.isValue(ICommandManager), typemoq.It.isAny()))
        .returns(() => commMgrMoq.object);
    const testHelper = new TestsHelper(new TestFlatteningVisitor(), serviceContainerMoq.object);

    return testHelper.flattenTestFiles([testFile]);
}

export function createMockTestStorageService(testData?: Tests): typemoq.IMock<ITestCollectionStorageService> {
    const testStoreMoq = typemoq.Mock.ofType<ITestCollectionStorageService>();

    if (!testData) {
        testData = createMockTestsData();
    }

    testStoreMoq.setup(t => t.getTests(typemoq.It.isAny())).returns(() => testData);

    return testStoreMoq;
}

/**
 * Create an IUnitTestManagementService that will work for the TeestTreeViewProvider in a unit test scenario.
 *
 * Provider an 'onDidStatusChange' hook that can be called, but that does nothing.
 */
export function createMockUnitTestMgmtService(): typemoq.IMock<IUnitTestManagementService> {
    const unitTestMgmtSrvMoq = typemoq.Mock.ofType<IUnitTestManagementService>();
    class ExplorerTestsDisposable implements IDisposable {
        // tslint:disable-next-line:no-empty
        public dispose() { }
    }
    unitTestMgmtSrvMoq.setup(u => u.onDidStatusChange(typemoq.It.isAny()))
        .returns(() => new ExplorerTestsDisposable());
    return unitTestMgmtSrvMoq;
}

/**
 * Create an IWorkspaceService mock that will work with the TestTreeViewProvider class.
 *
 * @param workspaceFolderPath Optional, the path to use as the current Resource-path for
 * the tests within the TestTree. Defaults to EXTENSION_ROOT_DIR_FOR_TESTS.
 */
export function createMockWorkspaceService(
    workspaceFolderPath: string = EXTENSION_ROOT_DIR_FOR_TESTS
): typemoq.IMock<IWorkspaceService> {
    const workspcSrvMoq = typemoq.Mock.ofType<IWorkspaceService>();
    class ExplorerTestsWorkspaceFolder implements WorkspaceFolder {
        public get uri(): Uri {
            return Uri.parse(workspaceFolderPath);
        }
        public get name(): string {
            return (path_parse(this.uri.fsPath)).base;
        }
        public get index(): number {
            return 0;
        }
    }
    workspcSrvMoq.setup(w => w.workspaceFolders)
        .returns(() => [new ExplorerTestsWorkspaceFolder()]);
    return workspcSrvMoq;
}

/**
 * Create a testable mocked up version of the TestExplorerViewProvider. Creates any
 * mocked dependencies not provided in the parameters.
 *
 * @param testStore Test storage service, provides access to the Tests structure that the view is built from.
 * @param unitTestMgmtService Unit test management service that provides the 'onTestStatusUpdated' event.
 * @param workspaceService Workspace service used to determine the current workspace that the test view is showing.
 * @param disposableReg Disposable registry used to dispose of items in the view.
 */
export function createMockTestExplorer(
    testStore?: ITestCollectionStorageService,
    testsData?: Tests,
    unitTestMgmtService?: IUnitTestManagementService,
    workspaceService?: IWorkspaceService
): TestTreeViewProvider {

    if (!testStore) {
        testStore = createMockTestStorageService(testsData).object;
    }

    if (!unitTestMgmtService) {
        unitTestMgmtService = createMockUnitTestMgmtService().object;
    }

    if (!workspaceService) {
        workspaceService = createMockWorkspaceService().object;
    }

    const dispRegMoq = typemoq.Mock.ofType<IDisposableRegistry>();
    dispRegMoq.setup(d => d.push(typemoq.It.isAny()));

    // tslint:disable-next-line:no-unnecessary-local-variable
    const viewProvider: TestTreeViewProvider =
        new TestTreeViewProvider(
            testStore, unitTestMgmtService, workspaceService, dispRegMoq.object);

    return viewProvider;
}
