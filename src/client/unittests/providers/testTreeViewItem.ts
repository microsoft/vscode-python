// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import {
    TreeItem, TreeItemCollapsibleState
} from 'vscode';
import {
    TestFile, TestFolder, TestFunction,
    TestStatus, TestSuite
} from '../common/types';

export enum TestTreeItemType {
    Root = 'Root',
    Package = 'Package',
    File = 'File',
    Suite = 'Suite',
    Function = 'Function'
}

export class TestTreeItem extends TreeItem {

    constructor(
        kind: TestTreeItemType,
        private readonly myParent: TestTreeItem,
        private readonly myChildren: TestTreeItem[],
        runId: string,
        name: string,
        testStatus: TestStatus = TestStatus.Unknown,
        // tslint:disable-next-line:no-unused-variable
        private readonly data: TestFolder | TestFile | TestSuite | TestFunction
    ) {

        super(
            `[${kind}] ${name}`,
            kind === TestTreeItemType.Function ? TreeItemCollapsibleState.None : TreeItemCollapsibleState.Collapsed
        );

        this.contextValue = kind;
        this.id = runId;
        this.tooltip = `Status: ${testStatus}`;
    }

    public static createFromFolder(
        folder: TestFolder,
        parent?: TestTreeItem
    ): TestTreeItem {

        const folderItem = new TestTreeItem(
            TestTreeItemType.Package,
            parent,
            [],
            folder.nameToRun,
            folder.name,
            folder.status,
            folder
        );

        folder.testFiles.forEach((testFile: TestFile) => {
            folderItem.children.push(TestTreeItem.createFromFile(testFile, folderItem));
        });

        return folderItem;
    }

    public static createFromFile(
        testFile: TestFile,
        parent?: TestTreeItem
    ): TestTreeItem {

        const fileItem = new TestTreeItem(
            TestTreeItemType.File,
            parent,
            [],
            testFile.nameToRun,
            testFile.name,
            testFile.status,
            testFile
        );

        testFile.functions.forEach((fn: TestFunction) => {
            fileItem.children.push(TestTreeItem.createFromFunction(fn, fileItem));
        });
        testFile.suites.forEach((suite: TestSuite) => {
            fileItem.children.push(TestTreeItem.createFromSuite(suite, fileItem));
        });

        return fileItem;
    }

    public static createFromSuite(
        suite: TestSuite,
        parent: TestTreeItem
    ): TestTreeItem {

        const suiteItem = new TestTreeItem(
            TestTreeItemType.Suite,
            parent,
            [],
            suite.nameToRun,
            suite.name,
            suite.status,
            suite
        );

        suite.suites.forEach((subSuite: TestSuite) => {
            suiteItem.children.push(TestTreeItem.createFromSuite(subSuite, suiteItem));
        });
        suite.functions.forEach((fn: TestFunction) => {
            suiteItem.children.push(TestTreeItem.createFromFunction(fn, suiteItem));
        });

        return suiteItem;
    }

    public static createFromFunction(
        fn: TestFunction,
        parent: TestTreeItem
    ): TestTreeItem {

        // tslint:disable-next-line:no-unnecessary-local-variable
        const funcItem = new TestTreeItem(
            TestTreeItemType.Function,
            parent,
            undefined,
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

    public get parent(): TestTreeItem {
        return this.myParent;
    }
}
