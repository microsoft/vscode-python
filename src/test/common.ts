import * as fs from 'fs-extra';
import * as path from 'path';
import { ConfigurationTarget, Uri, workspace } from 'vscode';
import { PythonSettings } from '../client/common/configSettings';
import { IS_MULTI_ROOT_TEST } from './initialize';

const fileInNonRootWorkspace = path.join(__dirname, '..', '..', 'src', 'test', 'pythonFiles', 'dummy.py');
export const rootWorkspaceUri = getWorkspaceRoot();

export type PythonSettingKeys = 'workspaceSymbols.enabled' | 'pythonPath' |
    'linting.lintOnSave' |
    'linting.enabled' | 'linting.pylintEnabled' |
    'linting.flake8Enabled' | 'linting.pep8Enabled' | 'linting.pylamaEnabled' |
    'linting.prospectorEnabled' | 'linting.pydocstyleEnabled' | 'linting.mypyEnabled' |
    'unitTest.nosetestArgs' | 'unitTest.pyTestArgs' | 'unitTest.unittestArgs' |
    'formatting.provider' | 'sortImports.args' |
    'unitTest.nosetestsEnabled' | 'unitTest.pyTestEnabled' | 'unitTest.unittestEnabled' |
    'linting.enabledWithoutWorkspace';

export async function updateSetting(setting: PythonSettingKeys, value: {}, resource: Uri | undefined, configTarget: ConfigurationTarget) {
    const settings = workspace.getConfiguration('python', resource);
    const currentValue = settings.inspect(setting);
    if (currentValue !== undefined && ((configTarget === ConfigurationTarget.Global && currentValue.globalValue === value) ||
        (configTarget === ConfigurationTarget.Workspace && currentValue.workspaceValue === value) ||
        (configTarget === ConfigurationTarget.WorkspaceFolder && currentValue.workspaceFolderValue === value))) {
        PythonSettings.dispose();
        return;
    }
    // tslint:disable-next-line:await-promise
    await settings.update(setting, value, configTarget);
    PythonSettings.dispose();
}

function getWorkspaceRoot() {
    if (!Array.isArray(workspace.workspaceFolders) || workspace.workspaceFolders.length === 0) {
        return Uri.file(path.join(__dirname, '..', '..', 'src', 'test'));
    }
    if (workspace.workspaceFolders.length === 1) {
        return workspace.workspaceFolders[0].uri;
    }
    const workspaceFolder = workspace.getWorkspaceFolder(Uri.file(fileInNonRootWorkspace));
    return workspaceFolder ? workspaceFolder.uri : workspace.workspaceFolders[0].uri;
}

// tslint:disable-next-line:no-any
export function retryAsync(wrapped: Function, retryCount: number = 2) {
    // tslint:disable-next-line:no-any
    return async (...args: any[]) => {
        return new Promise((resolve, reject) => {
            // tslint:disable-next-line:no-any
            const reasons: any[] = [];

            const makeCall = () => {
                // tslint:disable-next-line:no-unsafe-any no-any no-invalid-this
                wrapped.call(this, ...args)
                    // tslint:disable-next-line:no-unsafe-any no-any
                    .then(resolve, (reason: any) => {
                        reasons.push(reason);
                        if (reasons.length >= retryCount) {
                            reject(reasons);
                        } else {
                            // If failed once, lets wait for some time before trying again.
                            // tslint:disable-next-line:no-string-based-set-timeout
                            setTimeout(makeCall, 500);
                        }
                    });
            };

            makeCall();
        });
    };
}

async function setPythonPathInWorkspace(resource: string | Uri | undefined, config: ConfigurationTarget, pythonPath?: string) {
    if (config === ConfigurationTarget.WorkspaceFolder && !IS_MULTI_ROOT_TEST) {
        return;
    }
    const resourceUri = typeof resource === 'string' ? Uri.file(resource) : resource;
    const settings = workspace.getConfiguration('python', resourceUri);
    const value = settings.inspect<string>('pythonPath');
    const prop: 'workspaceFolderValue' | 'workspaceValue' = config === ConfigurationTarget.Workspace ? 'workspaceValue' : 'workspaceFolderValue';
    if (value && value[prop] !== pythonPath) {
        await settings.update('pythonPath', pythonPath, config);
        PythonSettings.dispose();
    }
}
async function restoreGlobalPythonPathSetting(): Promise<void> {
    const pythonConfig = workspace.getConfiguration('python');
    // tslint:disable-next-line:no-non-null-assertion
    const currentGlobalPythonPathSetting = pythonConfig.inspect('pythonPath')!.globalValue;
    // tslint:disable-next-line:no-use-before-declare
    if (globalPythonPathSetting !== currentGlobalPythonPathSetting) {
        await pythonConfig.update('pythonPath', undefined, true);
    }
    PythonSettings.dispose();
}

export async function deleteDirectory(dir: string) {
    const exists = await fs.pathExists(dir);
    if (exists) {
        await fs.remove(dir);
    }
}
export async function deleteFile(file: string) {
    const exists = await fs.pathExists(file);
    if (exists) {
        await fs.remove(file);
    }
}

// tslint:disable-next-line:no-non-null-assertion
const globalPythonPathSetting = workspace.getConfiguration('python').inspect('pythonPath')!.globalValue;
export const clearPythonPathInWorkspaceFolder = async (resource: string | Uri) => retryAsync(setPythonPathInWorkspace)(resource, ConfigurationTarget.WorkspaceFolder);
export const setPythonPathInWorkspaceRoot = async (pythonPath: string) => retryAsync(setPythonPathInWorkspace)(undefined, ConfigurationTarget.Workspace, pythonPath);
export const resetGlobalPythonPathSetting = async () => retryAsync(restoreGlobalPythonPathSetting)();
