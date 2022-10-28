// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ConfigurationScope, Uri, workspace, WorkspaceConfiguration, WorkspaceFolder } from 'vscode';

export function getWorkspaceFolder(resource: Uri | undefined): WorkspaceFolder | undefined {
    return resource ? workspace.getWorkspaceFolder(resource) : resource;
}

export function getWorkspaceFolders(): readonly WorkspaceFolder[] | undefined {
    return workspace.workspaceFolders;
}

export function getWorkspaceFolderPaths(): string[] {
    return workspace.workspaceFolders?.map((w) => w.uri.fsPath) ?? [];
}

export function getConfiguration(section?: string, scope?: ConfigurationScope | null): WorkspaceConfiguration {
    return workspace.getConfiguration(section, scope);
}
