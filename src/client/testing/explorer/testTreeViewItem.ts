// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-classes-per-file

import { ThemeIcon, TreeItem, TreeItemCollapsibleState, Uri } from 'vscode';
import { Commands } from '../../common/constants';
import { getIcon } from '../../common/utils/icons';
import { noop } from '../../common/utils/misc';
import { Icons } from '../common/constants';
import { getTestDataItemType, isSubtestsParent } from '../common/testUtils';
import { TestResult, TestStatus, TestSuite } from '../common/types';
import { TestDataItem, TestDataItemType } from '../types';

function getDefaultCollapsibleState(data: TestDataItem): TreeItemCollapsibleState {
    return getTestDataItemType(data) === TestDataItemType.function
        ? TreeItemCollapsibleState.None
        : TreeItemCollapsibleState.Collapsed;
}

/**
 * Class that represents a visual node on the
 * Test Explorer tree view. Is essentially a wrapper for the underlying
 * TestDataItem.
 */
export class TestTreeItem extends TreeItem {
    public readonly testType: TestDataItemType;

    constructor(
        public readonly resource: Uri,
        public readonly data: Readonly<TestDataItem>,
        collapsibleStatue: TreeItemCollapsibleState = getDefaultCollapsibleState(data)
    ) {
        super(data.name, collapsibleStatue);
        this.testType = getTestDataItemType(this.data);
        this.setCommand();
    }

    // @ts-ignore https://devblogs.microsoft.com/typescript/announcing-typescript-4-0-rc/#properties-overridding-accessors-and-vice-versa-is-an-error
    public get contextValue(): string {
        return this.testType;
    }

    // @ts-ignore https://devblogs.microsoft.com/typescript/announcing-typescript-4-0-rc/#properties-overridding-accessors-and-vice-versa-is-an-error
    public get iconPath(): string | Uri | { light: string | Uri; dark: string | Uri } | ThemeIcon {
        if (this.testType === TestDataItemType.workspaceFolder) {
            return ThemeIcon.Folder;
        }
        if (!this.data) {
            return '';
        }
        const status = this.data.status;
        switch (status) {
            case TestStatus.Error:
            case TestStatus.Fail: {
                return getIcon(Icons.failed);
            }
            case TestStatus.Pass: {
                return getIcon(Icons.passed);
            }
            case TestStatus.Discovering:
            case TestStatus.Running: {
                return getIcon(Icons.discovering);
            }
            case TestStatus.Idle:
            case TestStatus.Unknown: {
                return getIcon(Icons.unknown);
            }
            default: {
                return getIcon(Icons.unknown);
            }
        }
    }

    // @ts-ignore https://devblogs.microsoft.com/typescript/announcing-typescript-4-0-rc/#properties-overridding-accessors-and-vice-versa-is-an-error
    public get tooltip(): string {
        if (!this.data || this.testType === TestDataItemType.workspaceFolder) {
            return '';
        }
        const result = this.data as TestResult;
        if (
            !result.status ||
            result.status === TestStatus.Idle ||
            result.status === TestStatus.Unknown ||
            result.status === TestStatus.Skipped
        ) {
            return '';
        }
        if (this.testType !== TestDataItemType.function) {
            if (result.functionsPassed === undefined) {
                return '';
            }
            if (result.functionsDidNotRun) {
                return `${result.functionsFailed} failed, ${result.functionsDidNotRun} not run and ${result.functionsPassed} passed`;
            }
            return `${result.functionsFailed} failed, ${result.functionsPassed} passed`;
        }
        switch (this.data.status) {
            case TestStatus.Error:
            case TestStatus.Fail: {
                return `Failed in ${+result.time.toFixed(3)} seconds`;
            }
            case TestStatus.Pass: {
                return `Passed in ${+result.time.toFixed(3)} seconds`;
            }
            case TestStatus.Discovering:
            case TestStatus.Running: {
                return 'Loading...';
            }
            default: {
                return '';
            }
        }
    }

    /**
     * Tooltip for our tree nodes is the test status
     */
    public get testStatus(): string {
        return this.data.status ? this.data.status : TestStatus.Unknown;
    }

    private setCommand() {
        switch (this.testType) {
            case TestDataItemType.file: {
                this.command = {
                    command: Commands.navigateToTestFile,
                    title: 'Open',
                    arguments: [this.resource, this.data]
                };
                break;
            }
            case TestDataItemType.function: {
                this.command = {
                    command: Commands.navigateToTestFunction,
                    title: 'Open',
                    arguments: [this.resource, this.data, false]
                };
                break;
            }
            case TestDataItemType.suite: {
                if (isSubtestsParent(this.data as TestSuite)) {
                    this.command = {
                        command: Commands.navigateToTestFunction,
                        title: 'Open',
                        arguments: [this.resource, this.data, false]
                    };
                    break;
                }
                this.command = {
                    command: Commands.navigateToTestSuite,
                    title: 'Open',
                    arguments: [this.resource, this.data, false]
                };
                break;
            }
            default: {
                noop();
            }
        }
    }
}
