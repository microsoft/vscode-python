// tslint:disable:no-string-literal

import * as path from 'path';
import * as vscode from 'vscode';
import { IExtensionApi } from '../client/api';
import {
    clearPythonPathInWorkspaceFolder,
    IExtensionTestApi,
    PYTHON_PATH,
    resetGlobalPythonPathSetting,
    setPythonPathInWorkspaceRoot
} from './common';
import { IS_SMOKE_TEST, PVSC_EXTENSION_ID_FOR_TESTS } from './constants';

export * from './constants';
export * from './ciConstants';

const dummyPythonFile = path.join(__dirname, '..', '..', 'src', 'test', 'pythonFiles', 'dummy.py');
export const multirootPath = path.join(__dirname, '..', '..', 'src', 'testMultiRootWkspc');
const workspace3Uri = vscode.Uri.file(path.join(multirootPath, 'workspace3'));

//First thing to be executed.
process.env.VSC_PYTHON_CI_TEST = '1';

// Ability to use custom python environments for testing
export async function initializePython() {
    await resetGlobalPythonPathSetting();
    await clearPythonPathInWorkspaceFolder(dummyPythonFile);
    await clearPythonPathInWorkspaceFolder(workspace3Uri);
    await setPythonPathInWorkspaceRoot(PYTHON_PATH);
}

// tslint:disable-next-line:no-any
export async function initialize(): Promise<IExtensionTestApi> {
    await initializePython();
    const api = await activateExtension();
    if (!IS_SMOKE_TEST) {
        // When running smoke tests, we won't have access to these.
        const configSettings = await import('../client/common/configSettings');
        // Dispose any cached python settings (used only in test env).
        configSettings.PythonSettings.dispose();
    }
    // tslint:disable-next-line:no-any
    return (api as any) as IExtensionTestApi;
}
export async function activateExtension() {
    const extension = vscode.extensions.getExtension<IExtensionApi>(PVSC_EXTENSION_ID_FOR_TESTS)!;
    const api = await extension.activate();
    // Wait until its ready to use.
    await api.ready;
    return api;
}
// tslint:disable-next-line:no-any
export async function initializeTest(): Promise<any> {
    await initializePython();
    await closeActiveWindows();
    if (!IS_SMOKE_TEST) {
        // When running smoke tests, we won't have access to these.
        const configSettings = await import('../client/common/configSettings');
        // Dispose any cached python settings (used only in test env).
        configSettings.PythonSettings.dispose();
    }
}
export async function closeActiveWindows(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        // Attempt to fix #1301.
        // Lets not waste too much time.
        const timer = setTimeout(() => {
            reject(new Error("Command 'workbench.action.closeAllEditors' timed out"));
        }, 15000);
        vscode.commands.executeCommand('workbench.action.closeAllEditors').then(
            () => {
                clearTimeout(timer);
                resolve();
            },
            (ex) => {
                clearTimeout(timer);
                reject(ex);
            }
        );
    });
}
