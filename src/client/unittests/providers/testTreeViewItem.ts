// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import {
    TreeItem, TreeItemCollapsibleState, Uri
} from 'vscode';
import { Commands } from '../../common/constants';
import { noop } from '../../common/utils/misc';
import { TestsHelper } from '../common/testUtils';
import {
    TestFile, TestFolder, TestFunction,
    TestStatus, TestSuite, TestType
} from '../common/types';

export enum TestTreeItemType {
    Root = 'Root',
    Package = 'Package',
    File = 'File',
    Suite = 'Suite',
    Function = 'Function'
}

export class TestTreeItem extends TreeItem {
    public readonly testType: TestType;
    constructor(
        public readonly resource: Uri,
        kind: TestTreeItemType,
        private readonly myParent: TestTreeItem | undefined,
        private readonly myChildren: TestTreeItem[],
        runId: string,
        label: string,
        testStatus: TestStatus = TestStatus.Unknown,
        public readonly data: Readonly<TestFile> | Readonly<TestFolder> | Readonly<TestSuite> | Readonly<TestFunction>
    ) {

        super(
            `[${kind}] ${label}`,
            kind === TestTreeItemType.Function ? TreeItemCollapsibleState.None : TreeItemCollapsibleState.Collapsed
        );

        this.contextValue = kind;
        this.id = runId;
        this.tooltip = `Status: ${testStatus}`;
        this.testType = TestsHelper.getTestType(this.data);
        this.contextValue = TestsHelper.getTestType(this.data);
        this.setCommand();
    }

    public static createFromFolder(
        resource: Uri,
        folder: TestFolder,
        parent?: TestTreeItem
    ): TestTreeItem {

        const folderItem = new TestTreeItem(
            resource,
            TestTreeItemType.Package,
            parent,
            [],
            folder.nameToRun,
            folder.name,
            folder.status,
            folder
        );

        folder.testFiles.forEach((testFile: TestFile) => {
            folderItem.children.push(TestTreeItem.createFromFile(resource, testFile, folderItem));
        });

        return folderItem;
    }

    public static createFromFile(
        resource: Uri,
        testFile: TestFile,
        parent?: TestTreeItem
    ): TestTreeItem {

        const fileItem = new TestTreeItem(
            resource,
            TestTreeItemType.File,
            parent,
            [],
            testFile.nameToRun,
            testFile.name,
            testFile.status,
            testFile
        );

        testFile.functions.forEach((fn: TestFunction) => {
            fileItem.children.push(TestTreeItem.createFromFunction(resource, fn, fileItem));
        });
        testFile.suites.forEach((suite: TestSuite) => {
            fileItem.children.push(TestTreeItem.createFromSuite(resource, suite, fileItem));
        });

        return fileItem;
    }

    public static createFromSuite(
        resource: Uri,
        suite: TestSuite,
        parent: TestTreeItem
    ): TestTreeItem {

        const suiteItem = new TestTreeItem(
            resource,
            TestTreeItemType.Suite,
            parent,
            [],
            suite.nameToRun,
            suite.name,
            suite.status,
            suite
        );

        suite.suites.forEach((subSuite: TestSuite) => {
            suiteItem.children.push(TestTreeItem.createFromSuite(resource, subSuite, suiteItem));
        });
        suite.functions.forEach((fn: TestFunction) => {
            suiteItem.children.push(TestTreeItem.createFromFunction(resource, fn, suiteItem));
        });

        return suiteItem;
    }

    public static createFromFunction(
        resource: Uri,
        fn: TestFunction,
        parent: TestTreeItem
    ): TestTreeItem {

        // tslint:disable-next-line:no-unnecessary-local-variable
        const funcItem = new TestTreeItem(
            resource,
            TestTreeItemType.Function,
            parent,
            [],
            fn.nameToRun,
            fn.name,
            fn.status,
            fn
        );

        return funcItem;
    }

    public get children(): TestTreeItem[] {
        return this.myChildren;
    }

    public get parent(): TestTreeItem | undefined {
        return this.myParent;
    }
    private setCommand() {
        switch (this.testType) {
            case TestType.testFile: {
                this.command = { command: Commands.navigateToTestFile, title: 'Open', arguments: [this.resource, this.data] };
                break;
            }
            case TestType.testFunction: {
                this.command = { command: Commands.navigateToTestFunction, title: 'Open', arguments: [this.resource, this.data, false] };
                break;
            }
            case TestType.testSuite: {
                this.command = { command: Commands.navigateToTestSuite, title: 'Open', arguments: [this.resource, this.data, false] };
                break;
            }
            default: {
                noop();
            }
        }
    }
}
