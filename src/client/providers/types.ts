// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import {
    CancellationToken, Event, ProviderResult,
    TreeDataProvider, Uri, WorkspaceEdit
} from 'vscode';
import { PythonTestTreeItem } from './testTreeViewItem';

export const ISortImportsEditingProvider = Symbol('ISortImportsEditingProvider');
export interface ISortImportsEditingProvider {
    provideDocumentSortImportsEdits(uri: Uri, token?: CancellationToken): Promise<WorkspaceEdit | undefined>;
    sortImports(uri?: Uri): Promise<void>;
    registerCommands(): void;
}

export const IPythonTestTreeViewProvider = Symbol('IPythonTestTreeViewProvider');
export interface IPythonTestTreeViewProvider extends TreeDataProvider<PythonTestTreeItem> {
    onDidChangeTreeData: Event<PythonTestTreeItem | undefined>;
    getTreeItem(element: PythonTestTreeItem): Promise<PythonTestTreeItem>;
    getChildren(element?: PythonTestTreeItem): ProviderResult<PythonTestTreeItem[]>;
}
