// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import {
    CancellationToken, Event, ProviderResult,
    TreeDataProvider, Uri, WorkspaceEdit
} from 'vscode';
import { TestTreeItem } from '../unittests/providers/testTreeViewItem';

export const ISortImportsEditingProvider = Symbol('ISortImportsEditingProvider');
export interface ISortImportsEditingProvider {
    provideDocumentSortImportsEdits(uri: Uri, token?: CancellationToken): Promise<WorkspaceEdit | undefined>;
    sortImports(uri?: Uri): Promise<void>;
    registerCommands(): void;
}

export const ITestTreeViewProvider = Symbol('ITestTreeViewProvider');
export interface ITestTreeViewProvider extends TreeDataProvider<TestTreeItem> {
    onDidChangeTreeData: Event<TestTreeItem | undefined>;
    getTreeItem(element: TestTreeItem): Promise<TestTreeItem>;
    getChildren(element?: TestTreeItem): ProviderResult<TestTreeItem[]>;
}
