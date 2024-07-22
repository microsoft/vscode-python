// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {
    Disposable,
    Event,
    EventEmitter,
    FileChangeType,
    FileSystemWatcher,
    RelativePattern,
    Uri,
    WorkspaceFolder,
    WorkspaceFoldersChangeEvent,
} from 'vscode';
import { NativeEnvInfo } from './nativePythonFinder';
import { NativePythonEnvironmentKind } from './nativePythonUtils';
import {
    createFileSystemWatcher,
    getWorkspaceFolder,
    getWorkspaceFolderPaths,
} from '../../../../common/vscodeApis/workspaceApis';

export interface PythonWorkspaceEnvEvent {
    type: FileChangeType;
    workspaceFolder: WorkspaceFolder;
    envs?: NativeEnvInfo[];
}

export interface PythonGlobalEnvEvent {
    kind?: NativePythonEnvironmentKind;
    type?: FileChangeType;
}

export interface PythonWatcher extends Disposable {
    watchPath(uri: Uri): Disposable;
    onDidWorkspaceEnvChanged: Event<PythonWorkspaceEnvEvent>;
    onDidGlobalEnvChanged: Event<PythonGlobalEnvEvent>;
}

class PythonWatcherImpl implements PythonWatcher {
    private disposables: Disposable[] = [];

    private readonly _onDidWorkspaceEnvChanged = new EventEmitter<PythonWorkspaceEnvEvent>();

    private readonly _onDidGlobalEnvChanged = new EventEmitter<PythonGlobalEnvEvent>();

    constructor() {
        this.disposables.push(this._onDidWorkspaceEnvChanged, this._onDidGlobalEnvChanged);
    }

    onDidGlobalEnvChanged: Event<PythonGlobalEnvEvent> = this._onDidGlobalEnvChanged.event;

    onDidWorkspaceEnvChanged: Event<PythonWorkspaceEnvEvent> = this._onDidWorkspaceEnvChanged.event;

    watchPath(uri: Uri): Disposable {
        const wf = getWorkspaceFolder(uri);
        if (wf) {
            const watcher = this.watchWorkspaceFolder(wf);
            return watcher;
        }
    }

    private watchWorkspaceFolder(workspaceFolder: WorkspaceFolder): Disposable {
        const watcher = createFileSystemWatcher(new RelativePattern(workspaceFolder));
    }
}

export function createPythonWatcher(): PythonWatcher {
    return new PythonWatcherImpl();
}
