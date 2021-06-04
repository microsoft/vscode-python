// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';

export class WorkspaceTestRoot {
    public static create(options: vscode.TestItemOptions): vscode.TestItem<WorkspaceTestRoot> {
        const item = vscode.test.createTestItem<WorkspaceTestRoot>(options);
        item.data = new WorkspaceTestRoot(item);
        return item;
    }

    constructor(public readonly item: vscode.TestItem<WorkspaceTestRoot>) {}
}
