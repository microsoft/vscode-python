// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import * as vscode from 'vscode';
import { ConfigurationChangeEvent } from 'vscode';
import { IWorkspaceService } from './types';

@injectable()
export class WorkspaceService implements IWorkspaceService {
    public get onDidChangeConfiguration(): vscode.Event<ConfigurationChangeEvent> {
        return vscode.workspace.onDidChangeConfiguration;
    }
    public get rootPath(): string | undefined {
        return vscode.workspace.rootPath;
    }
    public get workspaceFolders(): vscode.WorkspaceFolder[] | undefined {
        return vscode.workspace.workspaceFolders;
    }
    public get onDidChangeWorkspaceFolders(): vscode.Event<vscode.WorkspaceFoldersChangeEvent> {
        return vscode.workspace.onDidChangeWorkspaceFolders;
    }
    public getConfiguration(section?: string, resource?: vscode.Uri): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration(section, resource);
    }
    public getWorkspaceFolder(uri: vscode.Uri): vscode.WorkspaceFolder | undefined {
        return vscode.workspace.getWorkspaceFolder(uri);
    }
    public asRelativePath(pathOrUri: string | vscode.Uri, includeWorkspaceFolder?: boolean): string {
        return vscode.workspace.asRelativePath(pathOrUri, includeWorkspaceFolder);
    }
    public createFileSystemWatcher(globPattern: vscode.GlobPattern, ignoreCreateEvents?: boolean, ignoreChangeEvents?: boolean, ignoreDeleteEvents?: boolean): vscode.FileSystemWatcher {
        return vscode.workspace.createFileSystemWatcher(globPattern, ignoreChangeEvents, ignoreChangeEvents, ignoreDeleteEvents);
    }
    public findFiles(include: vscode.GlobPattern, exclude?: vscode.GlobPattern, maxResults?: number, token?: vscode.CancellationToken): Thenable<vscode.Uri[]> {
        return vscode.workspace.findFiles(include, exclude, maxResults, token);
    }
    public get onDidSaveTextDocument(): vscode.Event<vscode.TextDocument> {
        return vscode.workspace.onDidSaveTextDocument;
    }
}
