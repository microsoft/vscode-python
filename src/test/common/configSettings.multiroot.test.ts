import * as assert from 'assert';
import * as path from 'path';
import { ConfigurationTarget, Uri, workspace } from 'vscode';
import { PythonSettings } from '../../client/common/configSettings';
import { clearPythonPathInWorkspaceFolder, getExtensionSettings } from '../common';
import { closeActiveWindows, initialize, initializeTest, IS_MULTI_ROOT_TEST } from '../initialize';

const multirootPath = path.join(__dirname, '..', '..', '..', 'src', 'testMultiRootWkspc');

// tslint:disable-next-line:max-func-body-length
suite('Multiroot Config Settings', () => {
    suiteSetup(async function () {
        if (!IS_MULTI_ROOT_TEST) {
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }
        await clearPythonPathInWorkspaceFolder(Uri.file(path.join(multirootPath, 'workspace1')));
        await initialize();
    });
    setup(initializeTest);
    suiteTeardown(closeActiveWindows);
    teardown(async () => {
        await closeActiveWindows();
        await clearPythonPathInWorkspaceFolder(Uri.file(path.join(multirootPath, 'workspace1')));
        await initializeTest();
    });

    async function enableDisableLinterSetting(resource: Uri, configTarget: ConfigurationTarget, setting: string, enabled: boolean | undefined): Promise<void> {
        const settings = workspace.getConfiguration('python.linting', resource);
        const cfgValue = settings.inspect<boolean>(setting);
        if (configTarget === ConfigurationTarget.Workspace && cfgValue && cfgValue.workspaceValue === enabled) {
            return;
        }
        if (configTarget === ConfigurationTarget.WorkspaceFolder && cfgValue && cfgValue.workspaceFolderValue === enabled) {
            return;
        }
        await settings.update(setting, enabled, configTarget);
        PythonSettings.dispose();
    }

    test('Workspace folder should inherit Python Path from workspace root', async () => {
        const workspaceUri = Uri.file(path.join(multirootPath, 'workspace1'));
        let settings = workspace.getConfiguration('python', workspaceUri);
        const pythonPath = `x${new Date().getTime()}`;
        await settings.update('pythonPath', pythonPath, ConfigurationTarget.Workspace);
        const value = settings.inspect('pythonPath');
        if (value && typeof value.workspaceFolderValue === 'string') {
            await settings.update('pythonPath', undefined, ConfigurationTarget.WorkspaceFolder);
        }
        settings = workspace.getConfiguration('python', workspaceUri);
        PythonSettings.dispose();
        const cfgSetting = getExtensionSettings(workspaceUri);
        assert.equal(cfgSetting.pythonPath, pythonPath, 'Python Path not inherited from workspace');
    });

    test('Workspace folder should not inherit Python Path from workspace root', async () => {
        const workspaceUri = Uri.file(path.join(multirootPath, 'workspace1'));
        const settings = workspace.getConfiguration('python', workspaceUri);
        const pythonPath = `x${new Date().getTime()}`;
        await settings.update('pythonPath', pythonPath, ConfigurationTarget.Workspace);
        const privatePythonPath = `x${new Date().getTime()}`;
        await settings.update('pythonPath', privatePythonPath, ConfigurationTarget.WorkspaceFolder);

        const cfgSetting = getExtensionSettings(workspaceUri);
        assert.equal(cfgSetting.pythonPath, privatePythonPath, 'Python Path for workspace folder is incorrect');
    });

    test('Workspace folder should inherit Python Path from workspace root when opening a document', async () => {
        const workspaceUri = Uri.file(path.join(multirootPath, 'workspace1'));
        const fileToOpen = path.join(multirootPath, 'workspace1', 'file.py');

        const settings = workspace.getConfiguration('python', workspaceUri);
        const pythonPath = `x${new Date().getTime()}`;
        await settings.update('pythonPath', pythonPath, ConfigurationTarget.Workspace);
        // Update workspace folder to something else so it gets refreshed.
        await settings.update('pythonPath', `x${new Date().getTime()}`, ConfigurationTarget.WorkspaceFolder);
        await settings.update('pythonPath', undefined, ConfigurationTarget.WorkspaceFolder);

        const document = await workspace.openTextDocument(fileToOpen);
        const cfg = getExtensionSettings(document.uri);
        assert.equal(cfg.pythonPath, pythonPath, 'Python Path not inherited from workspace');
    });

    test('Workspace folder should not inherit Python Path from workspace root when opening a document', async () => {
        const workspaceUri = Uri.file(path.join(multirootPath, 'workspace1'));
        const fileToOpen = path.join(multirootPath, 'workspace1', 'file.py');

        const settings = workspace.getConfiguration('python', workspaceUri);
        const pythonPath = `x${new Date().getTime()}`;
        await settings.update('pythonPath', pythonPath, ConfigurationTarget.Workspace);
        const privatePythonPath = `x${new Date().getTime()}`;
        await settings.update('pythonPath', privatePythonPath, ConfigurationTarget.WorkspaceFolder);

        const document = await workspace.openTextDocument(fileToOpen);
        const cfg = getExtensionSettings(document.uri);
        assert.equal(cfg.pythonPath, privatePythonPath, 'Python Path for workspace folder is incorrect');
    });

    test('Enabling/Disabling Pylint in root should be reflected in config settings', async () => {
        const workspaceUri = Uri.file(path.join(multirootPath, 'workspace1'));
        await enableDisableLinterSetting(workspaceUri, ConfigurationTarget.WorkspaceFolder, 'pylintEnabled', undefined);
        await enableDisableLinterSetting(workspaceUri, ConfigurationTarget.Workspace, 'pylintEnabled', true);
        let settings = getExtensionSettings(workspaceUri);
        assert.equal(settings.linting.pylintEnabled, true, 'Pylint not enabled when it should be');

        await enableDisableLinterSetting(workspaceUri, ConfigurationTarget.Workspace, 'pylintEnabled', false);
        settings = getExtensionSettings(workspaceUri);
        assert.equal(settings.linting.pylintEnabled, false, 'Pylint enabled when it should not be');
    });

    test('Enabling/Disabling Pylint in root and workspace should be reflected in config settings', async () => {
        const workspaceUri = Uri.file(path.join(multirootPath, 'workspace1'));

        await enableDisableLinterSetting(workspaceUri, ConfigurationTarget.WorkspaceFolder, 'pylintEnabled', false);
        await enableDisableLinterSetting(workspaceUri, ConfigurationTarget.Workspace, 'pylintEnabled', true);

        let cfgSetting = getExtensionSettings(workspaceUri);
        assert.equal(cfgSetting.linting.pylintEnabled, false, 'Workspace folder pylint setting is true when it should not be');
        PythonSettings.dispose();

        await enableDisableLinterSetting(workspaceUri, ConfigurationTarget.WorkspaceFolder, 'pylintEnabled', true);
        await enableDisableLinterSetting(workspaceUri, ConfigurationTarget.Workspace, 'pylintEnabled', false);

        cfgSetting = getExtensionSettings(workspaceUri);
        assert.equal(cfgSetting.linting.pylintEnabled, true, 'Workspace folder pylint setting is false when it should not be');
    });

    test('Enabling/Disabling Pylint in root should be reflected in config settings when opening a document', async () => {
        const workspaceUri = Uri.file(path.join(multirootPath, 'workspace1'));
        const fileToOpen = path.join(multirootPath, 'workspace1', 'file.py');

        await enableDisableLinterSetting(workspaceUri, ConfigurationTarget.Workspace, 'pylintEnabled', false);
        await enableDisableLinterSetting(workspaceUri, ConfigurationTarget.WorkspaceFolder, 'pylintEnabled', true);
        let document = await workspace.openTextDocument(fileToOpen);
        let cfg = getExtensionSettings(document.uri);
        assert.equal(cfg.linting.pylintEnabled, true, 'Pylint should be enabled in workspace');
        PythonSettings.dispose();

        await enableDisableLinterSetting(workspaceUri, ConfigurationTarget.Workspace, 'pylintEnabled', true);
        await enableDisableLinterSetting(workspaceUri, ConfigurationTarget.WorkspaceFolder, 'pylintEnabled', false);
        document = await workspace.openTextDocument(fileToOpen);
        cfg = getExtensionSettings(document.uri);
        assert.equal(cfg.linting.pylintEnabled, false, 'Pylint should not be enabled in workspace');
    });

    test('Enabling/Disabling Pylint in root should be reflected in config settings when opening a document', async () => {
        const workspaceUri = Uri.file(path.join(multirootPath, 'workspace1'));
        const fileToOpen = path.join(multirootPath, 'workspace1', 'file.py');

        await enableDisableLinterSetting(workspaceUri, ConfigurationTarget.Workspace, 'pylintEnabled', false);
        await enableDisableLinterSetting(workspaceUri, ConfigurationTarget.WorkspaceFolder, 'pylintEnabled', true);
        let document = await workspace.openTextDocument(fileToOpen);
        let cfg = getExtensionSettings(document.uri);
        assert.equal(cfg.linting.pylintEnabled, true, 'Pylint should be enabled in workspace');
        PythonSettings.dispose();

        await enableDisableLinterSetting(workspaceUri, ConfigurationTarget.Workspace, 'pylintEnabled', true);
        await enableDisableLinterSetting(workspaceUri, ConfigurationTarget.WorkspaceFolder, 'pylintEnabled', false);
        document = await workspace.openTextDocument(fileToOpen);
        cfg = getExtensionSettings(document.uri);
        assert.equal(cfg.linting.pylintEnabled, false, 'Pylint should not be enabled in workspace');
    });

    // tslint:disable-next-line:no-invalid-template-strings
    test('${workspaceFolder} variable in settings should be replaced with the right value', async () => {
        const workspace2Uri = Uri.file(path.join(multirootPath, 'workspace2'));
        let fileToOpen = path.join(workspace2Uri.fsPath, 'file.py');

        let document = await workspace.openTextDocument(fileToOpen);
        let cfg = getExtensionSettings(document.uri);
        assert.equal(path.dirname(cfg.workspaceSymbols.tagFilePath), workspace2Uri.fsPath, 'ctags file path for workspace2 is incorrect');
        assert.equal(path.basename(cfg.workspaceSymbols.tagFilePath), 'workspace2.tags.file', 'ctags file name for workspace2 is incorrect');
        PythonSettings.dispose();

        const workspace3Uri = Uri.file(path.join(multirootPath, 'workspace3'));
        fileToOpen = path.join(workspace3Uri.fsPath, 'file.py');

        document = await workspace.openTextDocument(fileToOpen);
        cfg = getExtensionSettings(document.uri);
        assert.equal(path.dirname(cfg.workspaceSymbols.tagFilePath), workspace3Uri.fsPath, 'ctags file path for workspace3 is incorrect');
        assert.equal(path.basename(cfg.workspaceSymbols.tagFilePath), 'workspace3.tags.file', 'ctags file name for workspace3 is incorrect');
        PythonSettings.dispose();
    });
});
