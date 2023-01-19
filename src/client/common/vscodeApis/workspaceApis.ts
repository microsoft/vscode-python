// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {
    CancellationToken,
    ConfigurationScope,
    GlobPattern,
    Uri,
    workspace,
    WorkspaceConfiguration,
    WorkspaceEdit,
    WorkspaceFolder,
} from 'vscode';
import { Resource } from '../types';

export function getWorkspaceFolders(): readonly WorkspaceFolder[] | undefined {
    return workspace.workspaceFolders;
}

export function getWorkspaceFolder(uri: Resource): WorkspaceFolder | undefined {
    return uri ? workspace.getWorkspaceFolder(uri) : undefined;
}

export function getWorkspaceFolderPaths(): string[] {
    return workspace.workspaceFolders?.map((w) => w.uri.fsPath) ?? [];
}

export function getConfiguration(section?: string, scope?: ConfigurationScope | null): WorkspaceConfiguration {
    return workspace.getConfiguration(section, scope);
}

export function applyEdit(edit: WorkspaceEdit): Thenable<boolean> {
    return workspace.applyEdit(edit);
}

export function findFiles(
    include: GlobPattern,
    exclude?: GlobPattern | null,
    maxResults?: number,
    token?: CancellationToken,
): Thenable<Uri[]> {
    return workspace.findFiles(include, exclude, maxResults, token);
}
