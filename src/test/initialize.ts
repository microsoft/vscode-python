// tslint:disable:no-string-literal

import * as path from 'path';
import * as vscode from 'vscode';
import { IExtensionApi } from '../client/api';
import { PythonSettings } from '../client/common/configSettings';
import { clearPythonPathInWorkspaceFolder, PYTHON_PATH, resetGlobalPythonPathSetting, setPythonPathInWorkspaceRoot } from './common';

export * from './constants';
export * from './ciConstants';

const dummyPythonFile = path.join(__dirname, '..', '..', 'src', 'test', 'pythonFiles', 'dummy.py');
const multirootPath = path.join(__dirname, '..', '..', 'src', 'testMultiRootWkspc');
const workspace3Uri = vscode.Uri.file(path.join(multirootPath, 'workspace3'));

//First thing to be executed.
process.env['VSC_PYTHON_CI_TEST'] = '1';

// Ability to use custom python environments for testing
export async function initializePython() {
    await resetGlobalPythonPathSetting();
    await clearPythonPathInWorkspaceFolder(dummyPythonFile);
    await clearPythonPathInWorkspaceFolder(workspace3Uri);
    await setPythonPathInWorkspaceRoot(PYTHON_PATH);
}

// tslint:disable-next-line:no-any
export async function initialize(): Promise<any> {
    await initializePython();
    await activateExtension();
    // Dispose any cached python settings (used only in test env).
    PythonSettings.dispose();
}
export async function activateExtension() {
    const extension = vscode.extensions.getExtension<IExtensionApi>('ms-python.python')!;
    if (extension.isActive) {
        return;
    }
    const api = await extension.activate();
    // Wait untill its ready to use.
    await api.ready;
}
// tslint:disable-next-line:no-any
export async function initializeTest(): Promise<any> {
    await initializePython();
    await closeActiveWindows();
    // Dispose any cached python settings (used only in test env).
    PythonSettings.dispose();
}
export async function closeActiveWindows(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        vscode.commands.executeCommand('workbench.action.closeAllEditors')
            // tslint:disable-next-line:no-unnecessary-callback-wrapper
            .then(() => resolve(), reject);
        // Attempt to fix #1301.
        // Lets not waste too much time.
        setTimeout(() => {
            reject(new Error('Command \'workbench.action.closeAllEditors\' timedout'));
        }, 15000);
    });
}
