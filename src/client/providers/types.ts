// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import {
    CancellationToken, Event, ProviderResult,
    TreeDataProvider, Uri, WorkspaceEdit
} from 'vscode';
import { TestFile, TestFolder, TestFunction, TestSuite } from '../unittests/common/types';
import { TestTreeItem } from '../unittests/explorer/testTreeViewItem';

export const ISortImportsEditingProvider = Symbol('ISortImportsEditingProvider');
export interface ISortImportsEditingProvider {
    provideDocumentSortImportsEdits(uri: Uri, token?: CancellationToken): Promise<WorkspaceEdit | undefined>;
    sortImports(uri?: Uri): Promise<void>;
    registerCommands(): void;
}

export type TestDataItem = TestFolder | TestFile | TestSuite | TestFunction;

export const ITestTreeViewProvider = Symbol('ITestTreeViewProvider');
export interface ITestTreeViewProvider extends TreeDataProvider<TestDataItem> {
    onDidChangeTreeData: Event<TestDataItem | undefined>;
    getTreeItem(element: TestDataItem): Promise<TestTreeItem>;
    getChildren(element?: TestDataItem): ProviderResult<TestDataItem[]>;
}
