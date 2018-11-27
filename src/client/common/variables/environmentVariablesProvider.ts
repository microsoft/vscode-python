// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Disposable, Event, EventEmitter, FileSystemWatcher, Uri, workspace } from 'vscode';
import { PythonSettings } from '../configSettings';
import { NON_WINDOWS_PATH_VARIABLE_NAME, WINDOWS_PATH_VARIABLE_NAME } from '../platform/constants';
import { ICurrentProcess, IDisposableRegistry, IsWindows } from '../types';
import { EnvironmentVariables, IEnvironmentVariablesProvider, IEnvironmentVariablesService } from './types';

@injectable()
export class EnvironmentVariablesProvider implements IEnvironmentVariablesProvider, Disposable {
    private cache = new Map<string, EnvironmentVariables>();
    private fileWatchers = new Map<string, FileSystemWatcher>();
    private disposables: Disposable[] = [];
    private changeEventEmitter: EventEmitter<Uri | undefined>;
    constructor(@inject(IEnvironmentVariablesService) private envVarsService: IEnvironmentVariablesService,
        @inject(IDisposableRegistry) disposableRegistry: Disposable[], @inject(IsWindows) private isWidows: boolean,
        @inject(ICurrentProcess) private process: ICurrentProcess) {
        disposableRegistry.push(this);
        this.changeEventEmitter = new EventEmitter();
    }

    public get onDidEnvironmentVariablesChange(): Event<Uri | undefined> {
        return this.changeEventEmitter.event;
    }

    public dispose() {
        this.changeEventEmitter.dispose();
        this.fileWatchers.forEach(watcher => {
            watcher.dispose();
        });
    }
    public async getEnvironmentVariables(resource?: Uri): Promise<EnvironmentVariables> {
        const settings = PythonSettings.getInstance(resource);
        if (!this.cache.has(settings.envFile)) {
            const workspaceFolderUri = this.getWorkspaceFolderUri(resource);
            this.createFileWatcher(settings.envFile, workspaceFolderUri);
            let mergedVars = await this.envVarsService.parseFile(settings.envFile);
            if (!mergedVars) {
                mergedVars = {};
            }
            this.envVarsService.mergeVariables(this.process.env, mergedVars!);
            const pathVariable = this.isWidows ? WINDOWS_PATH_VARIABLE_NAME : NON_WINDOWS_PATH_VARIABLE_NAME;
            const pathValue = this.process.env[pathVariable];
            if (pathValue) {
                this.envVarsService.appendPath(mergedVars!, pathValue);
            }
            if (this.process.env.PYTHONPATH) {
                this.envVarsService.appendPythonPath(mergedVars!, this.process.env.PYTHONPATH);
            }
            this.cache.set(settings.envFile, mergedVars);
        }
        return this.cache.get(settings.envFile)!;
    }
    private getWorkspaceFolderUri(resource?: Uri): Uri | undefined {
        if (!resource) {
            return;
        }
        const workspaceFolder = workspace.getWorkspaceFolder(resource!);
        return workspaceFolder ? workspaceFolder.uri : undefined;
    }
    private createFileWatcher(envFile: string, workspaceFolderUri?: Uri) {
        if (this.fileWatchers.has(envFile)) {
            return;
        }
        const envFileWatcher = workspace.createFileSystemWatcher(envFile);
        this.fileWatchers.set(envFile, envFileWatcher);
        if (envFileWatcher) {
            this.disposables.push(envFileWatcher.onDidChange(() => this.onEnvironmentFileChanged(envFile, workspaceFolderUri)));
            this.disposables.push(envFileWatcher.onDidCreate(() => this.onEnvironmentFileChanged(envFile, workspaceFolderUri)));
            this.disposables.push(envFileWatcher.onDidDelete(() => this.onEnvironmentFileChanged(envFile, workspaceFolderUri)));
        }
    }
    private onEnvironmentFileChanged(envFile, workspaceFolderUri?: Uri) {
        this.cache.delete(envFile);
        this.changeEventEmitter.fire(workspaceFolderUri);
    }
}
