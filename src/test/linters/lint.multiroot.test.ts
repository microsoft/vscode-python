import * as assert from 'assert';
import * as path from 'path';
import { CancellationTokenSource, ConfigurationTarget, OutputChannel, Uri, workspace } from 'vscode';
import { PythonSettings } from '../../client/common/configSettings';
import { IOutputChannel, Product } from '../../client/common/types';
import { ILinter, ILinterManager } from '../../client/linters/types';
import { TEST_OUTPUT_CHANNEL } from '../../client/unittests/common/constants';
import { closeActiveWindows, initialize, initializeTest, IS_MULTI_ROOT_TEST } from '../initialize';
import { UnitTestIocContainer } from '../unittests/serviceRegistry';

const multirootPath = path.join(__dirname, '..', '..', '..', 'src', 'testMultiRootWkspc');

suite('Multiroot Linting', () => {
    let ioc: UnitTestIocContainer;
    suiteSetup(function () {
        if (!IS_MULTI_ROOT_TEST) {
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }
        return initialize();
    });
    setup(async () => {
        initializeDI();
        await initializeTest();
    });
    suiteTeardown(closeActiveWindows);
    teardown(async () => {
        ioc.dispose();
        await closeActiveWindows();
        PythonSettings.dispose();
    });

    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerProcessTypes();
        ioc.registerLinterTypes();
        ioc.registerVariableTypes();
    }

    function createLinter(linter: Product, resource?: Uri): ILinter {
        const mockOutputChannel = ioc.serviceContainer.get<OutputChannel>(IOutputChannel, TEST_OUTPUT_CHANNEL);
        const lm = ioc.serviceContainer.get<ILinterManager>(ILinterManager);
        return lm.createLinter(linter, mockOutputChannel, ioc.serviceContainer);
    }
    async function testLinterInWorkspaceFolder(linter: ILinter, workspaceFolderRelativePath: string, mustHaveErrors: boolean) {
        const fileToLint = path.join(multirootPath, workspaceFolderRelativePath, 'file.py');
        const cancelToken = new CancellationTokenSource();
        const document = await workspace.openTextDocument(fileToLint);
        const messages = await linter.lint(document, cancelToken.token);
        const errorMessage = mustHaveErrors ? 'No errors returned by linter' : 'Errors returned by linter';
        assert.equal(messages.length > 0, mustHaveErrors, errorMessage);
    }
    async function enableDisableSetting(workspaceFolder, configTarget: ConfigurationTarget, setting: string, value: boolean) {
        const folderUri = Uri.file(workspaceFolder);
        const settings = workspace.getConfiguration('python.linting', folderUri);
        await settings.update(setting, value, configTarget);
    }

    test('Enabling Pylint in root and also in Workspace, should return errors', async () => {
        await enableDisableSetting(multirootPath, ConfigurationTarget.Workspace, 'pylintEnabled', true);
        await enableDisableSetting(path.join(multirootPath, 'workspace1'), ConfigurationTarget.WorkspaceFolder, 'pylintEnabled', true);
        await testLinterInWorkspaceFolder(createLinter(Product.pylint), 'workspace1', true);
    });

    test('Enabling Pylint in root and disabling in Workspace, should not return errors', async () => {
        await enableDisableSetting(multirootPath, ConfigurationTarget.Workspace, 'pylintEnabled', true);
        await enableDisableSetting(path.join(multirootPath, 'workspace1'), ConfigurationTarget.WorkspaceFolder, 'pylintEnabled', false);
        await testLinterInWorkspaceFolder(createLinter(Product.pylint), 'workspace1', false);
    });

    test('Disabling Pylint in root and enabling in Workspace, should return errors', async () => {
        await enableDisableSetting(multirootPath, ConfigurationTarget.Workspace, 'pylintEnabled', false);
        await enableDisableSetting(path.join(multirootPath, 'workspace1'), ConfigurationTarget.WorkspaceFolder, 'pylintEnabled', true);
        await testLinterInWorkspaceFolder(createLinter(Product.pylint), 'workspace1', true);
    });

    test('Enabling Flake8 in root and also in Workspace, should return errors', async () => {
        await enableDisableSetting(multirootPath, ConfigurationTarget.Workspace, 'flake8Enabled', true);
        await enableDisableSetting(path.join(multirootPath, 'workspace1'), ConfigurationTarget.WorkspaceFolder, 'flake8Enabled', true);
        await testLinterInWorkspaceFolder(createLinter(Product.flake8), 'workspace1', true);
    });

    test('Enabling Flake8 in root and disabling in Workspace, should not return errors', async () => {
        await enableDisableSetting(multirootPath, ConfigurationTarget.Workspace, 'flake8Enabled', true);
        await enableDisableSetting(path.join(multirootPath, 'workspace1'), ConfigurationTarget.WorkspaceFolder, 'flake8Enabled', false);
        await testLinterInWorkspaceFolder(createLinter(Product.flake8), 'workspace1', false);
    });

    test('Disabling Flake8 in root and enabling in Workspace, should return errors', async () => {
        await enableDisableSetting(multirootPath, ConfigurationTarget.Workspace, 'flake8Enabled', false);
        await enableDisableSetting(path.join(multirootPath, 'workspace1'), ConfigurationTarget.WorkspaceFolder, 'flake8Enabled', true);
        await testLinterInWorkspaceFolder(createLinter(Product.flake8), 'workspace1', true);
    });
});
