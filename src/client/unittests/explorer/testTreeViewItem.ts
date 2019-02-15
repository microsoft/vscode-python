// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-classes-per-file

import {
    TreeItem, TreeItemCollapsibleState, Uri
} from 'vscode';
import { Commands } from '../../common/constants';
import { traceError } from '../../common/logger';
import { noop } from '../../common/utils/misc';
import { TestsHelper } from '../common/testUtils';
import {
    TestFile, TestFolder, TestFunction,
    TestStatus, TestSuite, TestType
} from '../common/types';
import { TestDataItem } from '../types';

/**
 * Base class for a TestTreeItem that represents a visual node on the
 * Test Explorer tree view. Is essentially a wrapper for the underlying
 * TestDataItem.
 */
export abstract class TestTreeItem extends TreeItem {
    public readonly testType: TestType;
    private _children: TestTreeItem[];

    constructor(
        public readonly resource: Uri,
        public readonly data: Readonly<TestDataItem>,
        private readonly parentData: TestDataItem,
        label: string,
        collabsible: boolean = true
    ) {
        super(label, collabsible ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None);
        this.testType = TestsHelper.getTestType(this.data);
        this.setCommand();
    }

    /**
     * Parent is an extension to the TreeItem, to make it trivial to discover the node's parent.
     */
    public get parent(): TestDataItem {
        return this.parentData;
    }

    /**
     * Tooltip for our tree nodes is the test status
     */
    public get testStatus(): string {
        return this.data.status ? this.data.status : TestStatus.Unknown;
    }

    /**
     * Each test type will provide its children in a different way. pImpl used here.
     */
    public get children(): TestTreeItem[] {
        if (this._children === undefined) {
            this._children = this.getChildrenImpl();
        }
        return this._children;
    }

    protected abstract getChildrenImpl(): Readonly<TestTreeItem[]>;

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

export class TestFunctionTreeItem extends TestTreeItem {
    constructor(
        resource: Uri,
        parent: TestDataItem,
        fn: TestFunction
    ) {
        super(resource, fn, parent, `[Function] ${fn.name}`, false);
    }

    public get contextValue(): string {
        return TestType.testFunction;
    }

    /**
     * Test functions have no subordinates.
     */
    protected getChildrenImpl(): Readonly<TestTreeItem[]> {
        return [];
    }
}

export class TestSuiteTreeItem extends TestTreeItem {
    constructor(
        resource: Uri,
        parent: TestDataItem,
        suite: TestSuite
    ) {
        super(resource, suite, parent, `[Suite] ${suite.name}`);
    }

    public get contextValue(): string {
        return TestType.testSuite;
    }

    /**
     * Test suite items have functions and/or suites as subordinates.
     */
    protected getChildrenImpl(): Readonly<TestTreeItem[]> {
        const children: TestTreeItem[] = [];
        const suite: Readonly<TestSuite> = TestsHelper.getTestSuite(this.data);
        suite.functions.forEach((fn: TestFunction) => {
            children.push(new TestFunctionTreeItem(this.resource, this.data, fn));
        });
        suite.suites.forEach((subSuite: TestSuite) => {
            children.push(new TestSuiteTreeItem(this.resource, this.data, subSuite));
        });
        return children;
    }
}

export class TestFileTreeItem extends TestTreeItem {
    constructor(
        resource: Uri,
        parent: TestDataItem,
        fl: TestFile
    ) {
        super(resource, fl, parent, `[File] ${fl.name}`);
    }

    public get contextValue(): string {
        return TestType.testFile;
    }

    /**
     * Each test file can contain functions or suites.
     */
    protected getChildrenImpl(): Readonly<TestTreeItem[]> {
        const children: TestTreeItem[] = [];
        const fl: Readonly<TestFile> = TestsHelper.getTestFile(this.data);
        fl.functions.forEach((fn: TestFunction) => {
            children.push(new TestFunctionTreeItem(this.resource, this.data, fn));
        });
        fl.suites.forEach((suite: TestSuite) => {
            children.push(new TestSuiteTreeItem(this.resource, this.data, suite));
        });
        return children;
    }
}

export class TestFolderTreeItem extends TestTreeItem {
    constructor(
        resource: Uri,
        parent: TestDataItem,
        folder: TestFolder
    ) {
        super(resource, folder, parent, `[Folder] ${folder.name}`);
    }

    public get contextValue(): string {
        return TestType.testFolder;
    }

    /**
     * Test folders can contain only files. (Other folders are represented in a flat strucuture, never hierarchical)
     */
    protected getChildrenImpl(): Readonly<TestTreeItem[]> {
        const children: TestTreeItem[] = [];
        const folder: Readonly<TestFolder> = TestsHelper.getTestFolder(this.data);
        folder.testFiles.forEach((fl: TestFile) => {
            children.push(new TestFileTreeItem(this.resource, this.data, fl));
        });
        return children;
    }
}

/**
 * Create a TreView node from a given TestDataItem without having to specify the exact test item type.
 *
 * @param resource The workspace resource that this test item exists within.
 * @param testData The data item being represented in this tree view node.
 * @param parent The parent (or undefined, if the item is a root folder) of the test item.
 */
export function createTreeViewItemFrom(
    resource: Uri,
    testData: Readonly<TestDataItem>,
    parent?: TestDataItem
): TestTreeItem {
    let item: TestTreeItem;
    const testDataType = TestsHelper.getTestType(testData);
    switch (testDataType) {
        case TestType.testFile: {
            item = new TestFileTreeItem(resource, parent, TestsHelper.getTestFile(testData));
            break;
        }
        case TestType.testFolder: {
            item = new TestFolderTreeItem(resource, parent, TestsHelper.getTestFolder(testData));
            break;
        }
        case TestType.testSuite: {
            item = new TestSuiteTreeItem(resource, parent, TestsHelper.getTestSuite(testData));
            break;
        }
        case TestType.testFunction: {
            item = new TestFunctionTreeItem(resource, parent, TestsHelper.getTestFunction(testData));
            break;
        }
        default: {
            traceError(`Cannot create test view item for unknown test Data Type "${testDataType}". This item will not appear in the Test Explorer.`);
            break;
        }
    }
    return item;
}
