// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { workspace, WorkspaceFolder } from 'vscode';

export function getWorkspaceFolders(): readonly WorkspaceFolder[] | undefined {
    return workspace.workspaceFolders;
}

export function getWorkspaceFolderPaths(): string[] {
    return workspace.workspaceFolders?.map((w) => w.uri.fsPath) ?? [];
}
