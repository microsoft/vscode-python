// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import {
    TreeItem, TreeItemCollapsibleState
} from 'vscode';
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
        kind: PythonTestTreeItemType,
        private myParent: PythonTestTreeItem,
        private myChildren: PythonTestTreeItem[],
        runId: string,
        name: string,
        testStatus: TestStatus = TestStatus.Unknown) {

        super(
            `[${kind}] ${name}`,
            kind === PythonTestTreeItemType.Function ? TreeItemCollapsibleState.None : TreeItemCollapsibleState.Collapsed
        );

        this.contextValue = kind;
        this.id = runId;
        this.tooltip = `Status: ${testStatus}`;
    }

    public get children(): PythonTestTreeItem[] {
        return this.myChildren;
    }

    public get parent(): PythonTestTreeItem {
        return this.myParent;
    }
}
