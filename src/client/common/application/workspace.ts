// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import {
    CancellationToken,
    ConfigurationChangeEvent,
    Event,
    FileSystemWatcher,
    GlobPattern,
    Uri,
    workspace,
    WorkspaceConfiguration,
    WorkspaceFolder,
    WorkspaceFoldersChangeEvent
} from 'vscode';
import { Resource } from '../types';
import { IWorkspaceService } from './types';

@injectable()
export class WorkspaceService implements IWorkspaceService {
    public get onDidChangeConfiguration(): Event<ConfigurationChangeEvent> {
        return workspace.onDidChangeConfiguration;
    }
    public get rootPath(): string | undefined {
        return Array.isArray(workspace.workspaceFolders) ? workspace.workspaceFolders[0].uri.fsPath : undefined;
    }
    public get workspaceFolders(): WorkspaceFolder[] | undefined {
        return workspace.workspaceFolders;
    }
    public get onDidChangeWorkspaceFolders(): Event<WorkspaceFoldersChangeEvent> {
        return workspace.onDidChangeWorkspaceFolders;
    }
    public get hasWorkspaceFolders() {
        return Array.isArray(workspace.workspaceFolders) && workspace.workspaceFolders.length > 0;
    }
    public getConfiguration(section?: string, resource?: Uri): WorkspaceConfiguration {
        return workspace.getConfiguration(section, resource || null);
    }
    public getWorkspaceFolder(uri: Resource): WorkspaceFolder | undefined {
        return uri ? workspace.getWorkspaceFolder(uri) : undefined;
    }
    public asRelativePath(pathOrUri: string | Uri, includeWorkspaceFolder?: boolean): string {
        return workspace.asRelativePath(pathOrUri, includeWorkspaceFolder);
    }
    public createFileSystemWatcher(globPattern: GlobPattern, _ignoreCreateEvents?: boolean, ignoreChangeEvents?: boolean, ignoreDeleteEvents?: boolean): FileSystemWatcher {
        return workspace.createFileSystemWatcher(globPattern, ignoreChangeEvents, ignoreChangeEvents, ignoreDeleteEvents);
    }
    public findFiles(include: GlobPattern, exclude?: GlobPattern, maxResults?: number, token?: CancellationToken): Thenable<Uri[]> {
        return workspace.findFiles(include, exclude, maxResults, token);
    }
    public getWorkspaceFolderIdentifier(resource: Resource, defaultValue: string = ''): string {
        const workspaceFolder = resource ? workspace.getWorkspaceFolder(resource) : undefined;
        return workspaceFolder ? workspaceFolder.uri.fsPath : defaultValue;
    }
}
