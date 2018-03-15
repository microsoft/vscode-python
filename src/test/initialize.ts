// tslint:disable:no-string-literal

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { PythonSettings } from '../client/common/configSettings';
import { activated } from '../client/extension';
import { clearPythonPathInWorkspaceFolder, resetGlobalPythonPathSetting, setPythonPathInWorkspaceRoot } from './common';

export * from './constants';

const dummyPythonFile = path.join(__dirname, '..', '..', 'src', 'test', 'pythonFiles', 'dummy.py');
const multirootPath = path.join(__dirname, '..', '..', 'src', 'testMultiRootWkspc');
const workspace3Uri = vscode.Uri.file(path.join(multirootPath, 'workspace3'));

//First thing to be executed.
process.env['VSC_PYTHON_CI_TEST'] = '1';

const PYTHON_PATH = getPythonPath();

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
    // Opening a python file activates the extension.
    await vscode.workspace.openTextDocument(dummyPythonFile);
    await activated;
    // Dispose any cached python settings (used only in test env).
    PythonSettings.dispose();
}
// tslint:disable-next-line:no-any
export async function initializeTest(): Promise<any> {
    await initializePython();
    await closeActiveWindows();
    // Dispose any cached python settings (used only in test env).
    PythonSettings.dispose();
}

export async function closeActiveWindows(): Promise<void> {
    return new Promise<void>((resolve, reject) => vscode.commands.executeCommand('workbench.action.closeAllEditors')
        // tslint:disable-next-line:no-unnecessary-callback-wrapper
        .then(() => resolve(), reject));
}

function getPythonPath(): string {
    // tslint:disable-next-line:no-unsafe-any
    if (process.env.TRAVIS_PYTHON_PATH && fs.existsSync(process.env.TRAVIS_PYTHON_PATH)) {
        // tslint:disable-next-line:no-unsafe-any
        return process.env.TRAVIS_PYTHON_PATH;
    }
    return 'python';
}
