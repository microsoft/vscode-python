// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import {
    TreeItem, TreeItemCollapsibleState
} from 'vscode';
import {
    TestFile, TestFolder, TestFunction,
    TestStatus, TestSuite
} from '../unittests/common/types';

export enum PythonTestTreeItemType {
    Root = 'Root',
    Package = 'Package',
    File = 'File',
    Suite = 'Suite',
    Function = 'Function'
}

export class PythonTestTreeItem extends TreeItem {

    constructor(
        kind: PythonTestTreeItemType,
        private myParent: PythonTestTreeItem,
        private myChildren: PythonTestTreeItem[],
        runId: string,
        name: string,
        testStatus: TestStatus = TestStatus.Unknown,
        // tslint:disable-next-line:no-unused-variable
        private data: TestFolder | TestFile | TestSuite | TestFunction
    ) {

        super(
            `[${kind}] ${name}`,
            kind === PythonTestTreeItemType.Function ? TreeItemCollapsibleState.None : TreeItemCollapsibleState.Collapsed
        );

        this.contextValue = kind;
        this.id = runId;
        this.tooltip = `Status: ${testStatus}`;
    }

    public static createFromFolder(
        folder: TestFolder,
        parent?: PythonTestTreeItem
    ): PythonTestTreeItem {

        const folderItem = new PythonTestTreeItem(
            PythonTestTreeItemType.Package,
            parent,
            [],
            folder.nameToRun,
            folder.name,
            folder.status,
            folder
        );

        folder.testFiles.forEach((testFile: TestFile) => {
            folderItem.children.push(PythonTestTreeItem.createFromFile(testFile, folderItem));
        });

        return folderItem;
    }

    public static createFromFile(
        testFile: TestFile,
        parent?: PythonTestTreeItem
    ): PythonTestTreeItem {

        const fileItem = new PythonTestTreeItem(
            PythonTestTreeItemType.File,
            parent,
            [],
            testFile.nameToRun,
            testFile.name,
            testFile.status,
            testFile
        );

        testFile.functions.forEach((fn: TestFunction) => {
            fileItem.children.push(PythonTestTreeItem.createFromFunction(fn, fileItem));
        });
        testFile.suites.forEach((suite: TestSuite) => {
            fileItem.children.push(PythonTestTreeItem.createFromSuite(suite, fileItem));
        });

        return fileItem;
    }

    public static createFromSuite(
        suite: TestSuite,
        parent: PythonTestTreeItem
    ): PythonTestTreeItem {

        const suiteItem = new PythonTestTreeItem(
            PythonTestTreeItemType.Suite,
            parent,
            [],
            suite.nameToRun,
            suite.name,
            suite.status,
            suite
        );

        suite.suites.forEach((subSuite: TestSuite) => {
            suiteItem.children.push(PythonTestTreeItem.createFromSuite(subSuite, suiteItem));
        });
        suite.functions.forEach((fn: TestFunction) => {
            suiteItem.children.push(PythonTestTreeItem.createFromFunction(fn, suiteItem));
        });

        return suiteItem;
    }

    public static createFromFunction(
        fn: TestFunction,
        parent: PythonTestTreeItem
    ): PythonTestTreeItem {

        // tslint:disable-next-line:no-unnecessary-local-variable
        const funcItem = new PythonTestTreeItem(
            PythonTestTreeItemType.Function,
            parent,
            undefined,
            fn.nameToRun,
            fn.name,
            fn.status,
            fn
        );

        return funcItem;
    }

    public get children(): PythonTestTreeItem[] {
        return this.myChildren;
    }

    public get parent(): PythonTestTreeItem {
        return this.myParent;
    }
}
