import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { PythonSettings } from '../client/common/configSettings';
import { activated } from '../client/extension';
import { clearPythonPathInWorkspaceFolder, resetGlobalPythonPathSetting, setPythonPathInWorkspaceRoot } from './common';

const dummyPythonFile = path.join(__dirname, '..', '..', 'src', 'test', 'pythonFiles', 'dummy.py');
const multirootPath = path.join(__dirname, '..', '..', 'src', 'testMultiRootWkspc');
const workspace3Uri = vscode.Uri.file(path.join(multirootPath, 'workspace3'));

//First thing to be executed.
// tslint:disable-next-line:no-string-literal
process.env['VSC_PYTHON_CI_TEST'] = '1';

const PYTHON_PATH = getPythonPath();
// tslint:disable-next-line:no-string-literal prefer-template
export const IS_TRAVIS = (process.env['TRAVIS'] + '') === 'true';
export const TEST_TIMEOUT = 25000;
export const IS_MULTI_ROOT_TEST = isMultitrootTest();

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

export async function wait(timeoutMilliseconds: number) {
    return new Promise(resolve => {
        // tslint:disable-next-line:no-string-based-set-timeout
        setTimeout(resolve, timeoutMilliseconds);
    });
}

// tslint:disable-next-line:no-any
export async function closeActiveWindows(): Promise<any> {
    // https://github.com/Microsoft/vscode/blob/master/extensions/vscode-api-tests/src/utils.ts
    return new Promise(resolve => {
        if (vscode.window.visibleTextEditors.length === 0) {
            return resolve();
        }

        // tslint:disable-next-line:no-suspicious-comment
        // TODO: the visibleTextEditors variable doesn't seem to be
        // up to date after a onDidChangeActiveTextEditor event, not
        // even using a setTimeout 0... so we MUST poll :(
        const interval = setInterval(() => {
            if (vscode.window.visibleTextEditors.length > 0) {
                return;
            }

            clearInterval(interval);
            resolve();
        }, 10);

        setTimeout(() => {
            if (vscode.window.visibleTextEditors.length === 0) {
                return resolve();
            }
            vscode.commands.executeCommand('workbench.action.closeAllEditors')
                // tslint:disable-next-line:no-any
                .then(() => null, (err: any) => {
                    clearInterval(interval);
                    resolve();
                });
        }, 50);

    });
}

function getPythonPath(): string {
    // tslint:disable-next-line:no-unsafe-any
    if (process.env.TRAVIS_PYTHON_PATH && fs.existsSync(process.env.TRAVIS_PYTHON_PATH)) {
        // tslint:disable-next-line:no-unsafe-any
        return process.env.TRAVIS_PYTHON_PATH;
    }
    return 'python';
}

function isMultitrootTest() {
    return Array.isArray(vscode.workspace.workspaceFolders) && vscode.workspace.workspaceFolders.length > 1;
}
