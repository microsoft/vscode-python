import * as assert from 'assert';
import * as path from 'path';
import { CancellationTokenSource, ConfigurationTarget, Uri, window, workspace } from 'vscode';
import { PythonSettings } from '../../client/common/configSettings';
import * as baseLinter from '../../client/linters/baseLinter';
import * as flake8 from '../../client/linters/flake8';
import * as pyLint from '../../client/linters/pylint';
import { closeActiveWindows, initialize, initializeTest, IS_MULTI_ROOT_TEST } from '../initialize';
import { MockOutputChannel } from '../mockClasses';

const multirootPath = path.join(__dirname, '..', '..', '..', 'src', 'testMultiRootWkspc');

suite('Multiroot Linting', () => {
    suiteSetup(function () {
        if (!IS_MULTI_ROOT_TEST) {
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }
        return initialize();
    });
    setup(initializeTest);
    suiteTeardown(closeActiveWindows);
    teardown(async () => {
        await closeActiveWindows();
        PythonSettings.dispose();
    });

    async function testLinterInWorkspaceFolder(linter: baseLinter.BaseLinter, workspaceFolderRelativePath: string, mustHaveErrors: boolean) {
        const fileToLint = path.join(multirootPath, workspaceFolderRelativePath, 'file.py');
        const cancelToken = new CancellationTokenSource();
        const document = await workspace.openTextDocument(fileToLint);
        const editor = await window.showTextDocument(document);
        const messages = await linter.lint(editor.document, cancelToken.token);
        const errorMessage = mustHaveErrors ? 'No errors returned by linter' : 'Errors returned by linter';
        assert.equal(messages.length > 0, mustHaveErrors, errorMessage);
    }
    async function enableDisableSetting(workspaceFolder, configTarget: ConfigurationTarget, setting: string, value: boolean) {
        const folderUri = Uri.file(workspaceFolder);
        const settings = workspace.getConfiguration('python.linting', folderUri);
        await settings.update(setting, value, configTarget);
    }

    test('Enabling Pylint in root and also in Workspace, should return errors', async () => {
        const ch = new MockOutputChannel('Lint');
        await enableDisableSetting(multirootPath, ConfigurationTarget.Workspace, 'pylintEnabled', true);
        await enableDisableSetting(path.join(multirootPath, 'workspace1'), ConfigurationTarget.WorkspaceFolder, 'pylintEnabled', true);
        await testLinterInWorkspaceFolder(new pyLint.Linter(ch), 'workspace1', true);
    });

    test('Enabling Pylint in root and disabling in Workspace, should not return errors', async () => {
        const ch = new MockOutputChannel('Lint');
        await enableDisableSetting(multirootPath, ConfigurationTarget.Workspace, 'pylintEnabled', true);
        await enableDisableSetting(path.join(multirootPath, 'workspace1'), ConfigurationTarget.WorkspaceFolder, 'pylintEnabled', false);
        await testLinterInWorkspaceFolder(new pyLint.Linter(ch), 'workspace1', false);
    });

    test('Disabling Pylint in root and enabling in Workspace, should return errors', async () => {
        const ch = new MockOutputChannel('Lint');
        await enableDisableSetting(multirootPath, ConfigurationTarget.Workspace, 'pylintEnabled', false);
        await enableDisableSetting(path.join(multirootPath, 'workspace1'), ConfigurationTarget.WorkspaceFolder, 'pylintEnabled', true);
        await testLinterInWorkspaceFolder(new pyLint.Linter(ch), 'workspace1', true);
    });

    test('Enabling Flake8 in root and also in Workspace, should return errors', async () => {
        const ch = new MockOutputChannel('Lint');
        await enableDisableSetting(multirootPath, ConfigurationTarget.Workspace, 'flake8Enabled', true);
        await enableDisableSetting(path.join(multirootPath, 'workspace1'), ConfigurationTarget.WorkspaceFolder, 'flake8Enabled', true);
        await testLinterInWorkspaceFolder(new flake8.Linter(ch), 'workspace1', true);
    });

    test('Enabling Flake8 in root and disabling in Workspace, should not return errors', async () => {
        const ch = new MockOutputChannel('Lint');
        await enableDisableSetting(multirootPath, ConfigurationTarget.Workspace, 'flake8Enabled', true);
        await enableDisableSetting(path.join(multirootPath, 'workspace1'), ConfigurationTarget.WorkspaceFolder, 'flake8Enabled', false);
        await testLinterInWorkspaceFolder(new flake8.Linter(ch), 'workspace1', false);
    });

    test('Disabling Flake8 in root and enabling in Workspace, should return errors', async () => {
        const ch = new MockOutputChannel('Lint');
        await enableDisableSetting(multirootPath, ConfigurationTarget.Workspace, 'flake8Enabled', false);
        await enableDisableSetting(path.join(multirootPath, 'workspace1'), ConfigurationTarget.WorkspaceFolder, 'flake8Enabled', true);
        await testLinterInWorkspaceFolder(new flake8.Linter(ch), 'workspace1', true);
    });
});
