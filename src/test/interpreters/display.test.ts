import * as assert from 'assert';
import * as child_process from 'child_process';
import { EOL } from 'os';
import * as path from 'path';
import { ConfigurationTarget, Uri, window, workspace } from 'vscode';
import { PythonSettings } from '../../client/common/configSettings';
import { InterpreterType } from '../../client/interpreter/contracts';
import { InterpreterDisplay } from '../../client/interpreter/display';
import { getFirstNonEmptyLineFromMultilineString } from '../../client/interpreter/helpers';
import { VirtualEnvironmentManager } from '../../client/interpreter/virtualEnvs';
import { clearPythonPathInWorkspaceFolder, rootWorkspaceUri, updateSetting } from '../common';
import { closeActiveWindows, initialize, initializeTest, IS_MULTI_ROOT_TEST } from '../initialize';
import { MockStatusBarItem } from '../mockClasses';
import { MockInterpreterVersionProvider } from './mocks';
import { MockProvider, MockVirtualEnv } from './mocks';

const fileInNonRootWorkspace = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'dummy.py');

// tslint:disable-next-line:max-func-body-length
suite('Interpreters Display', () => {
    const configTarget = IS_MULTI_ROOT_TEST ? ConfigurationTarget.WorkspaceFolder : ConfigurationTarget.Workspace;
    suiteSetup(initialize);
    setup(async () => {
        await initializeTest();
        if (IS_MULTI_ROOT_TEST) {
            await initializeMultiRoot();
        }
    });
    teardown(async () => {
        await clearPythonPathInWorkspaceFolder(fileInNonRootWorkspace);
        await initialize();
        await closeActiveWindows();
    });
    test('Must have command name', () => {
        const statusBar = new MockStatusBarItem();
        const displayNameProvider = new MockInterpreterVersionProvider('');
        // tslint:disable-next-line:no-unused-expression
        new InterpreterDisplay(statusBar, new MockProvider([]), new VirtualEnvironmentManager([]), displayNameProvider);
        assert.equal(statusBar.command, 'python.setInterpreter', 'Incorrect command name');
    });
    test('Must get display name from interpreter itself', async () => {
        const statusBar = new MockStatusBarItem();
        const provider = new MockProvider([]);
        const displayName = 'Mock Display Name';
        const displayNameProvider = new MockInterpreterVersionProvider(displayName);
        const display = new InterpreterDisplay(statusBar, provider, new VirtualEnvironmentManager([]), displayNameProvider);
        await display.refresh();

        assert.equal(statusBar.text, displayName, 'Incorrect display name');
    });
    test('Must suffix display name with name of interpreter', async () => {
        const statusBar = new MockStatusBarItem();
        const provider = new MockProvider([]);
        const env1 = new MockVirtualEnv(false, 'Mock 1');
        const env2 = new MockVirtualEnv(true, 'Mock 2');
        const env3 = new MockVirtualEnv(true, 'Mock 3');
        const displayName = 'Mock Display Name';
        const displayNameProvider = new MockInterpreterVersionProvider(displayName);
        const display = new InterpreterDisplay(statusBar, provider, new VirtualEnvironmentManager([env1, env2, env3]), displayNameProvider);
        await display.refresh();
        assert.equal(statusBar.text, `${displayName} (${env2.name})`, 'Incorrect display name');
    });
    test('Must display default \'Display name\' for unknown interpreter', async () => {
        const statusBar = new MockStatusBarItem();
        const provider = new MockProvider([]);
        const displayName = 'Mock Display Name';
        const displayNameProvider = new MockInterpreterVersionProvider(displayName, true);
        const display = new InterpreterDisplay(statusBar, provider, new VirtualEnvironmentManager([]), displayNameProvider);
        // Change interpreter to an invalid value
        const pythonPath = 'UnknownInterpreter';
        await updateSetting('pythonPath', pythonPath, rootWorkspaceUri, configTarget);
        await display.refresh();

        const defaultDisplayName = `${path.basename(pythonPath)} [Environment]`;
        assert.equal(statusBar.text, defaultDisplayName, 'Incorrect display name');
    });
    test('Must get display name from a list of interpreters', async () => {
        const pythonPath = await new Promise<string>(resolve => {
            child_process.execFile(PythonSettings.getInstance(Uri.file(fileInNonRootWorkspace)).pythonPath, ['-c', 'import sys;print(sys.executable)'], (_, stdout) => {
                resolve(getFirstNonEmptyLineFromMultilineString(stdout));
            });
        }).then(value => value.length === 0 ? PythonSettings.getInstance(Uri.file(fileInNonRootWorkspace)).pythonPath : value);
        const statusBar = new MockStatusBarItem();
        const interpreters = [
            { displayName: 'One', path: 'c:/path1/one.exe', type: InterpreterType.VirtualEnv },
            { displayName: 'Two', path: pythonPath, type: InterpreterType.VirtualEnv },
            { displayName: 'Three', path: 'c:/path3/three.exe', type: InterpreterType.VirtualEnv }
        ];
        const provider = new MockProvider(interpreters);
        const displayName = 'Mock Display Name';
        const displayNameProvider = new MockInterpreterVersionProvider(displayName, true);
        const display = new InterpreterDisplay(statusBar, provider, new VirtualEnvironmentManager([]), displayNameProvider);
        await display.refresh();

        assert.equal(statusBar.text, interpreters[1].displayName, 'Incorrect display name');
    });
    test('Must suffix tooltip with the companyDisplayName of interpreter', async () => {
        const pythonPath = await new Promise<string>(resolve => {
            child_process.execFile(PythonSettings.getInstance(Uri.file(fileInNonRootWorkspace)).pythonPath, ['-c', 'import sys;print(sys.executable)'], (_, stdout) => {
                resolve(getFirstNonEmptyLineFromMultilineString(stdout));
            });
        }).then(value => value.length === 0 ? PythonSettings.getInstance(Uri.file(fileInNonRootWorkspace)).pythonPath : value);

        const statusBar = new MockStatusBarItem();
        const interpreters = [
            { displayName: 'One', path: 'c:/path1/one.exe', companyDisplayName: 'One 1', type: InterpreterType.VirtualEnv },
            { displayName: 'Two', path: pythonPath, companyDisplayName: 'Two 2', type: InterpreterType.VirtualEnv },
            { displayName: 'Three', path: 'c:/path3/three.exe', companyDisplayName: 'Three 3', type: InterpreterType.VirtualEnv }
        ];
        const provider = new MockProvider(interpreters);
        const displayNameProvider = new MockInterpreterVersionProvider('');
        const display = new InterpreterDisplay(statusBar, provider, new VirtualEnvironmentManager([]), displayNameProvider);
        await display.refresh();

        assert.equal(statusBar.text, interpreters[1].displayName, 'Incorrect display name');
        assert.equal(statusBar.tooltip, `${pythonPath}${EOL}${interpreters[1].companyDisplayName}`, 'Incorrect tooltip');
    });
    test('Will update status prompting user to select an interpreter', async () => {
        const statusBar = new MockStatusBarItem();
        const interpreters = [
            { displayName: 'One', path: 'c:/path1/one.exe', companyDisplayName: 'One 1', type: InterpreterType.VirtualEnv },
            { displayName: 'Two', path: 'c:/asdf', companyDisplayName: 'Two 2', type: InterpreterType.VirtualEnv },
            { displayName: 'Three', path: 'c:/path3/three.exe', companyDisplayName: 'Three 3', type: InterpreterType.VirtualEnv }
        ];
        const provider = new MockProvider(interpreters);
        const displayNameProvider = new MockInterpreterVersionProvider('', true);
        const display = new InterpreterDisplay(statusBar, provider, new VirtualEnvironmentManager([]), displayNameProvider);
        // Change interpreter to an invalid value
        const pythonPath = 'UnknownInterpreter';
        await updateSetting('pythonPath', pythonPath, rootWorkspaceUri, configTarget);
        await display.refresh();

        assert.equal(statusBar.text, '$(alert) Select Python Environment', 'Incorrect display name');
    });
    async function initializeMultiRoot() {
        // For multiroot environments, we need a file open to determine the best interpreter that needs to be displayed
        await openDummyFile();
    }
    async function openDummyFile() {
        const document = await workspace.openTextDocument(fileInNonRootWorkspace);
        await window.showTextDocument(document);
    }
});
