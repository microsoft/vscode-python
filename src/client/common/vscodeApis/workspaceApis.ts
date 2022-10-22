// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ConfigurationScope, workspace, WorkspaceConfiguration, WorkspaceFolder } from 'vscode';

export function getWorkspaceFolders(): readonly WorkspaceFolder[] | undefined {
    return workspace.workspaceFolders;
}

export function getWorkspaceFolderPaths(): string[] {
    return workspace.workspaceFolders?.map((w) => w.uri.fsPath) ?? [];
}

export function getConfiguration(section?: string, scope?: ConfigurationScope | null): WorkspaceConfiguration {
    return workspace.getConfiguration(section, scope);
}
