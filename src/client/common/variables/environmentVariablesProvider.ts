// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import 'reflect-metadata';
import { Disposable, FileSystemWatcher, Uri, workspace } from 'vscode';
import { PythonSettings } from '../configSettings';
import { NON_WINDOWS_PATH_VARIABLE_NAME, WINDOWS_PATH_VARIABLE_NAME } from '../platform/constants';
import { IDiposableRegistry, IsWindows } from '../types';
import { EnvironmentVariables, IEnvironmentVariablesProvider, IEnvironmentVariablesService } from './types';

@injectable()
export class EnvironmentVariablesProvider implements IEnvironmentVariablesProvider, Disposable {
    private cache = new Map<string, { vars: EnvironmentVariables | undefined, mergedWithProc: EnvironmentVariables }>();
    private fileWatchers = new Map<string, FileSystemWatcher>();
    private disposables: Disposable[] = [];

    constructor( @inject(IEnvironmentVariablesService) private envVarsService: IEnvironmentVariablesService,
        @inject(IDiposableRegistry) disposableRegistry: Disposable[], @inject(IsWindows) private isWidows: boolean) {
        disposableRegistry.push(this);
    }

    public dispose() {
        this.fileWatchers.forEach(watcher => {
            watcher.dispose();
        });
    }
    public async getEnvironmentVariables(mergeWithProcEnvVariables: boolean, resource?: Uri): Promise<EnvironmentVariables | undefined> {
        const settings = PythonSettings.getInstance(resource);
        if (!this.cache.has(settings.envFile)) {
            this.createFileWatcher(settings.envFile);
            const vars = await this.envVarsService.parseFile(settings.envFile);
            let mergedVars = await this.envVarsService.parseFile(settings.envFile);
            if (!mergedVars || Object.keys(mergedVars).length === 0) {
                mergedVars = { ...process.env };
            }
            this.envVarsService.mergeVariables(process.env, mergedVars!);
            const pathVariable = this.isWidows ? WINDOWS_PATH_VARIABLE_NAME : NON_WINDOWS_PATH_VARIABLE_NAME;
            this.envVarsService.appendPath(mergedVars!, process.env[pathVariable]);
            this.envVarsService.appendPythonPath(mergedVars!, process.env.PYTHONPATH);
            this.cache.set(settings.envFile, { vars, mergedWithProc: mergedVars! });
        }
        const data = this.cache.get(settings.envFile)!;
        return mergeWithProcEnvVariables ? data.mergedWithProc : data.vars;
    }
    private createFileWatcher(envFile: string) {
        if (this.fileWatchers.has(envFile)) {
            return;
        }
        const envFileWatcher = workspace.createFileSystemWatcher(envFile);
        this.fileWatchers.set(envFile, envFileWatcher);
        this.disposables.push(envFileWatcher.onDidChange(() => this.cache.delete(envFile)));
        this.disposables.push(envFileWatcher.onDidCreate(() => this.cache.delete(envFile)));
        this.disposables.push(envFileWatcher.onDidDelete(() => this.cache.delete(envFile)));
    }
}
