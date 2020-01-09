import * as assert from 'assert';
import * as path from 'path';
import { CancellationTokenSource, ConfigurationTarget, OutputChannel, Uri, workspace } from 'vscode';
import { PythonSettings } from '../../client/common/configSettings';
import {
    CTagsProductPathService,
    DataScienceProductPathService,
    FormatterProductPathService,
    LinterProductPathService,
    RefactoringLibraryProductPathService,
    TestFrameworkProductPathService
} from '../../client/common/installer/productPath';
import { ProductService } from '../../client/common/installer/productService';
import { IProductPathService, IProductService } from '../../client/common/installer/types';
import { IConfigurationService, IOutputChannel, Product, ProductType } from '../../client/common/types';
import { ICondaService } from '../../client/interpreter/contracts';
import { CondaService } from '../../client/interpreter/locators/services/condaService';
import { ILinter, ILinterManager } from '../../client/linters/types';
import { TEST_OUTPUT_CHANNEL } from '../../client/testing/common/constants';
import { closeActiveWindows, initialize, initializeTest, IS_MULTI_ROOT_TEST } from '../initialize';
import { UnitTestIocContainer } from '../testing/serviceRegistry';

// tslint:disable:max-func-body-length no-invalid-this

const multirootPath = path.join(__dirname, '..', '..', '..', 'src', 'testMultiRootWkspc');

suite('Multiroot Linting', () => {
    const pylintSetting = 'linting.pylintEnabled';
    const flake8Setting = 'linting.flake8Enabled';

    let ioc: UnitTestIocContainer;
    suiteSetup(function() {
        if (!IS_MULTI_ROOT_TEST) {
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
        await ioc.dispose();
        await closeActiveWindows();
        PythonSettings.dispose();
    });

    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes(false);
        ioc.registerProcessTypes();
        ioc.registerLinterTypes();
        ioc.registerVariableTypes();
        ioc.registerFileSystemTypes();
        ioc.registerMockInterpreterTypes();
        ioc.serviceManager.addSingletonInstance<IProductService>(IProductService, new ProductService());
        ioc.serviceManager.addSingleton<ICondaService>(ICondaService, CondaService);
        ioc.serviceManager.addSingleton<IProductPathService>(IProductPathService, CTagsProductPathService, ProductType.WorkspaceSymbols);
        ioc.serviceManager.addSingleton<IProductPathService>(IProductPathService, FormatterProductPathService, ProductType.Formatter);
        ioc.serviceManager.addSingleton<IProductPathService>(IProductPathService, LinterProductPathService, ProductType.Linter);
        ioc.serviceManager.addSingleton<IProductPathService>(IProductPathService, TestFrameworkProductPathService, ProductType.TestFramework);
        ioc.serviceManager.addSingleton<IProductPathService>(IProductPathService, RefactoringLibraryProductPathService, ProductType.RefactoringLibrary);
        ioc.serviceManager.addSingleton<IProductPathService>(IProductPathService, DataScienceProductPathService, ProductType.DataScience);
    }

    async function createLinter(product: Product): Promise<ILinter> {
        const mockOutputChannel = ioc.serviceContainer.get<OutputChannel>(IOutputChannel, TEST_OUTPUT_CHANNEL);
        const lm = ioc.serviceContainer.get<ILinterManager>(ILinterManager);
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
        const config = ioc.serviceContainer.get<IConfigurationService>(IConfigurationService);
        await Promise.all([
            config.updateSetting(setting, global, Uri.file(multirootPath), ConfigurationTarget.Global),
            config.updateSetting(setting, wks, Uri.file(multirootPath), ConfigurationTarget.Workspace)
        ]);
        await testLinterInWorkspaceFolder(product, 'workspace1', wks);
        await Promise.all(
            [ConfigurationTarget.Global, ConfigurationTarget.Workspace].map(configTarget => config.updateSetting(setting, undefined, Uri.file(multirootPath), configTarget))
        );
    }
});
