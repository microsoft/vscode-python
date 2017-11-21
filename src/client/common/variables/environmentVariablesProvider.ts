import { Disposable, FileSystemWatcher, Uri, workspace } from 'vscode';
import { PythonSettings } from '../configSettings';
import { EnvironmentVariables, IEnvironmentVariablesProvider, IEnvironmentVariablesService } from './types';

export class EnvironmentVariablesProvider implements IEnvironmentVariablesProvider, Disposable {
    private cache = new Map<string, EnvironmentVariables | undefined>();
    private fileWatchers = new Map<string, FileSystemWatcher>();
    private disposables: Disposable[] = [];

    constructor(private envVarsService: IEnvironmentVariablesService) { }

    public dispose() {
        this.fileWatchers.forEach(watcher => {
            watcher.dispose();
        });
    }
    public async getEnvironmentVariables(resource?: Uri): Promise<EnvironmentVariables | undefined> {
        const settings = PythonSettings.getInstance(resource);
        if (this.cache.has(settings.envFile)) {
            return this.cache.get(settings.envFile);
        }
        this.createFileWatcher(settings.envFile);
        const vars = await this.envVarsService.parseFile(settings.envFile);
        this.cache.set(settings.envFile, vars);
        return vars;
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
