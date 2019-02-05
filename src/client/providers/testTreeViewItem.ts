// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { TestStatus } from '../unittests/common/types';

export enum PythonTestTreeItemType {
    Root = 'Root',
    Package = 'Package',
    File = 'File',
    Suite = 'Suite',
    Function = 'Function'
}

export class PythonTestTreeItem extends TreeItem {

    constructor(
        private kind: PythonTestTreeItemType,
        private myParent: PythonTestTreeItem,
        private myChildren: PythonTestTreeItem[],
        private runId: string,
        private name: string,
        private testStatus: TestStatus = TestStatus.Unknown) {

        super(`[${kind}] ${name}`, kind === PythonTestTreeItemType.Function ? TreeItemCollapsibleState.None : TreeItemCollapsibleState.Collapsed);
    }

    public get children(): PythonTestTreeItem[] {
        return this.myChildren;

    }

    public get parent(): PythonTestTreeItem {
        return this.myParent;
    }
}
