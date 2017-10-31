import { Uri, workspace } from 'vscode';

type InterpreterCache = {
    pythonInterpreterDirectory?: string;
    pythonInterpreterPath?: string;
    pythonSettingsPath?: string;
    // tslint:disable-next-line:no-any
    customEnvVariables?: any;
};

const cache = new Map<string, InterpreterCache>();

// tslint:disable-next-line:no-stateless-class
export class InterpreterInfoCache {
    // tslint:disable-next-line:function-name
    public static clear(): void {
        cache.clear();
    }
    // tslint:disable-next-line:function-name
    public static get(resource?: Uri) {
        const cacheKey = InterpreterInfoCache.getCacheKey(resource) || '';
        return cache.has(cacheKey) ? cache.get(cacheKey) : {};
    }
    // tslint:disable-next-line:function-name
    public static setPaths(resource?: Uri, pythonSettingsPath?: string, pythonInterpreterPath?: string, pythonInterpreterDirectory?: string) {
        InterpreterInfoCache.setCacheData('pythonInterpreterDirectory', resource, pythonInterpreterDirectory);
        InterpreterInfoCache.setCacheData('pythonInterpreterPath', resource, pythonInterpreterPath);
        InterpreterInfoCache.setCacheData('pythonSettingsPath', resource, pythonSettingsPath);
    }

    // tslint:disable-next-line:no-any function-name
    public static setCustomEnvVariables(resource?: Uri, envVars?: any) {
        // tslint:disable-next-line:no-any
        InterpreterInfoCache.setCacheData('customEnvVariables', resource, envVars);
    }
    // tslint:disable-next-line:no-any function-name
    private static setCacheData(property: keyof InterpreterCache, resource?: Uri, value?: any) {
        const cacheKey = InterpreterInfoCache.getCacheKey(resource) || '';
        // tslint:disable-next-line:prefer-type-cast
        const data = cache.has(cacheKey) ? cache.get(cacheKey) : {} as InterpreterCache;
        data[property] = value;
        cache.set(cacheKey, data);
    }
    private static getCacheKey(resource?: Uri): string {
        if (!Array.isArray(workspace.workspaceFolders) || workspace.workspaceFolders.length === 0) {
            return '';
        }
        if (!resource || workspace.workspaceFolders.length === 1) {
            return workspace.workspaceFolders[0].uri.fsPath;
        }
        const folder = workspace.getWorkspaceFolder(resource);
        return folder ? folder.uri.fsPath : '';
    }
}
