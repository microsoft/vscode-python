// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { Resource } from '../types';

export function getWorkspaceFolders(): readonly vscode.WorkspaceFolder[] | undefined {
    return vscode.workspace.workspaceFolders;
}

export function getWorkspaceFolder(uri: Resource): vscode.WorkspaceFolder | undefined {
    return uri ? vscode.workspace.getWorkspaceFolder(uri) : undefined;
}

export function getWorkspaceFolderPaths(): string[] {
    return vscode.workspace.workspaceFolders?.map((w) => w.uri.fsPath) ?? [];
}

export function getConfiguration(
    section?: string,
    scope?: vscode.ConfigurationScope | null,
): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(section, scope);
}

export function applyEdit(edit: vscode.WorkspaceEdit): Thenable<boolean> {
    return vscode.workspace.applyEdit(edit);
}

export function findFiles(
    include: vscode.GlobPattern,
    exclude?: vscode.GlobPattern | null,
    maxResults?: number,
    token?: vscode.CancellationToken,
): Thenable<vscode.Uri[]> {
    return vscode.workspace.findFiles(include, exclude, maxResults, token);
}

export function onDidSaveTextDocument(
    listener: (e: vscode.TextDocument) => unknown,
    thisArgs?: unknown,
    disposables?: vscode.Disposable[],
): vscode.Disposable {
    return vscode.workspace.onDidSaveTextDocument(listener, thisArgs, disposables);
}

export function getOpenTextDocuments(): readonly vscode.TextDocument[] {
    return vscode.workspace.textDocuments;
}

export function onDidOpenTextDocument(handler: (doc: vscode.TextDocument) => unknown): vscode.Disposable {
    return vscode.workspace.onDidOpenTextDocument(handler);
}

export function onDidChangeTextDocument(handler: (e: vscode.TextDocumentChangeEvent) => unknown): vscode.Disposable {
    return vscode.workspace.onDidChangeTextDocument(handler);
}

export function onDidChangeConfiguration(handler: (e: vscode.ConfigurationChangeEvent) => unknown): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration(handler);
}
