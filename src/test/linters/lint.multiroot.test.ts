import * as assert from 'assert';
import * as path from 'path';
import { CancellationTokenSource, ConfigurationTarget, OutputChannel, Uri, workspace } from 'vscode';
import { PythonSettings } from '../../client/common/configSettings';
import { IConfigurationService, IOutputChannel, Product } from '../../client/common/types';
import { ILinter, ILinterManager } from '../../client/linters/types';
import { TEST_OUTPUT_CHANNEL } from '../../client/unittests/common/constants';
import { closeActiveWindows, initialize, initializeTest, IS_MULTI_ROOT_TEST } from '../initialize';
import { UnitTestIocContainer } from '../unittests/serviceRegistry';

const multirootPath = path.join(__dirname, '..', '..', '..', 'src', 'testMultiRootWkspc');

// tslint:disable-next-line:max-func-body-length
suite('Multiroot Linting', () => {
    const pylintSetting = 'linting.pylintEnabled';
    const flake8Setting = 'linting.flake8Enabled';

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
        ioc.registerCommonTypes(false);
        ioc.registerProcessTypes();
        ioc.registerLinterTypes();
        ioc.registerVariableTypes();
        ioc.registerPlatformTypes();
    }

    async function createLinter(product: Product, resource?: Uri): Promise<ILinter> {
        const mockOutputChannel = ioc.serviceContainer.get<OutputChannel>(IOutputChannel, TEST_OUTPUT_CHANNEL);
        const lm = ioc.serviceContainer.get<ILinterManager>(ILinterManager);
        await lm.setActiveLintersAsync([product], resource);
        return lm.createLinter(product, mockOutputChannel, ioc.serviceContainer);
    }
    async function testLinterInWorkspaceFolder(product: Product, workspaceFolderRelativePath: string, mustHaveErrors: boolean): Promise<void> {
        const fileToLint = path.join(multirootPath, workspaceFolderRelativePath, 'file.py');
        const cancelToken = new CancellationTokenSource();
        const document = await workspace.openTextDocument(fileToLint);

        const linter = await createLinter(product);
        const messages = await linter.lint(document, cancelToken.token);

        const errorMessage = mustHaveErrors ? 'No errors returned by linter' : 'Errors returned by linter';
        assert.equal(messages.length > 0, mustHaveErrors, errorMessage);
    }
    async function enableDisableSetting(workspaceFolder, configTarget: ConfigurationTarget, setting: string, value: boolean): Promise<void> {
        const config = ioc.serviceContainer.get<IConfigurationService>(IConfigurationService);
        await config.updateSettingAsync(setting, value, Uri.file(workspaceFolder), configTarget);
    }

    test('Enabling Pylint in root and also in Workspace, should return errors', async () => {
        await runTest(Product.pylint, true, true, pylintSetting);
    });
    test('Enabling Pylint in root and disabling in Workspace, should not return errors', async () => {
        await runTest(Product.pylint, true, false, pylintSetting);
    });
    test('Disabling Pylint in root and enabling in Workspace, should return errors', async () => {
        await runTest(Product.pylint, false, true, pylintSetting);
    });

    test('Enabling Flake8 in root and also in Workspace, should return errors', async () => {
        await runTest(Product.flake8, true, true, flake8Setting);
    });
    test('Enabling Flake8 in root and disabling in Workspace, should not return errors', async () => {
        await runTest(Product.flake8, true, false, flake8Setting);
    });
    test('Disabling Flake8 in root and enabling in Workspace, should return errors', async () => {
        await runTest(Product.flake8, false, true, flake8Setting);
    });

    async function runTest(product: Product, global: boolean, wks: boolean, setting: string): Promise<void> {
        const expected = wks ? wks : global;
        await enableDisableSetting(multirootPath, ConfigurationTarget.Global, setting, global);
        await enableDisableSetting(multirootPath, ConfigurationTarget.Workspace, setting, wks);
        await testLinterInWorkspaceFolder(product, 'workspace1', expected);
    }
});
