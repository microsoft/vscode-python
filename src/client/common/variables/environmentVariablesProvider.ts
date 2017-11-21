import { inject, injectable } from 'inversify';
import { Disposable, FileSystemWatcher, Uri, workspace } from 'vscode';
import { PythonSettings } from '../configSettings';
import { IDiposableRegistry } from '../types';
import { EnvironmentVariables, IEnvironmentVariablesProvider, IEnvironmentVariablesService } from './types';

@injectable()
export class EnvironmentVariablesProvider implements IEnvironmentVariablesProvider, Disposable {
    private cache = new Map<string, { vars: EnvironmentVariables | undefined, mergedWithProc: EnvironmentVariables }>();
    private fileWatchers = new Map<string, FileSystemWatcher>();
    private disposables: Disposable[] = [];

    constructor( @inject(IEnvironmentVariablesService) private envVarsService: IEnvironmentVariablesService,
        @inject(IDiposableRegistry) disposableRegistry: Disposable[]) {
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
            const mergedVars = await this.envVarsService.parseFile(settings.envFile);
            this.envVarsService.mergeVariables(process.env, mergedVars);
            this.cache.set(settings.envFile, { vars, mergedWithProc: mergedVars });
        }
        const data = this.cache.get(settings.envFile);
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
