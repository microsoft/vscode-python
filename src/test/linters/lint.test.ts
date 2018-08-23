import * as assert from 'assert';
import * as fs from 'fs-extra';
import * as path from 'path';
import { CancellationTokenSource, ConfigurationTarget, DiagnosticCollection, Uri, window, workspace } from 'vscode';
import { ICommandManager } from '../../client/common/application/types';
import { STANDARD_OUTPUT_CHANNEL } from '../../client/common/constants';
import { Product } from '../../client/common/installer/productInstaller';
import { CTagsProductPathService, FormatterProductPathService, LinterProductPathService, RefactoringLibraryProductPathService, TestFrameworkProductPathService } from '../../client/common/installer/productPath';
import { ProductService } from '../../client/common/installer/productService';
import { IProductPathService, IProductService } from '../../client/common/installer/types';
import { IConfigurationService, IOutputChannel, ProductType } from '../../client/common/types';
import { LinterManager } from '../../client/linters/linterManager';
import { ILinterManager, ILintMessage, LintMessageSeverity } from '../../client/linters/types';
import { deleteFile, PythonSettingKeys, rootWorkspaceUri } from '../common';
import { closeActiveWindows, initialize, initializeTest, IS_MULTI_ROOT_TEST } from '../initialize';
import { MockOutputChannel } from '../mockClasses';
import { UnitTestIocContainer } from '../unittests/serviceRegistry';

const workspaceUri = Uri.file(path.join(__dirname, '..', '..', '..', 'src', 'test'));
const pythoFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'linting');
const flake8ConfigPath = path.join(pythoFilesPath, 'flake8config');
const pep8ConfigPath = path.join(pythoFilesPath, 'pep8config');
const pydocstyleConfigPath27 = path.join(pythoFilesPath, 'pydocstyleconfig27');
const pylintConfigPath = path.join(pythoFilesPath, 'pylintconfig');
const fileToLint = path.join(pythoFilesPath, 'file.py');
const threeLinLintsPath = path.join(pythoFilesPath, 'threeLineLints.py');

const pylintMessagesToBeReturned: ILintMessage[] = [
    { line: 24, column: 0, severity: LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', provider: '', type: '' },
    { line: 30, column: 0, severity: LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', provider: '', type: '' },
    { line: 34, column: 0, severity: LintMessageSeverity.Information, code: 'I0012', message: 'Locally enabling no-member (E1101)', provider: '', type: '' },
    { line: 40, column: 0, severity: LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', provider: '', type: '' },
    { line: 44, column: 0, severity: LintMessageSeverity.Information, code: 'I0012', message: 'Locally enabling no-member (E1101)', provider: '', type: '' },
    { line: 55, column: 0, severity: LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', provider: '', type: '' },
    { line: 59, column: 0, severity: LintMessageSeverity.Information, code: 'I0012', message: 'Locally enabling no-member (E1101)', provider: '', type: '' },
    { line: 62, column: 0, severity: LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling undefined-variable (E0602)', provider: '', type: '' },
    { line: 70, column: 0, severity: LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', provider: '', type: '' },
    { line: 84, column: 0, severity: LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', provider: '', type: '' },
    { line: 87, column: 0, severity: LintMessageSeverity.Hint, code: 'C0304', message: 'Final newline missing', provider: '', type: '' },
    { line: 11, column: 20, severity: LintMessageSeverity.Warning, code: 'W0613', message: 'Unused argument \'arg\'', provider: '', type: '' },
    { line: 26, column: 14, severity: LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blop\' member', provider: '', type: '' },
    { line: 36, column: 14, severity: LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 46, column: 18, severity: LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 61, column: 18, severity: LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 72, column: 18, severity: LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 75, column: 18, severity: LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 77, column: 14, severity: LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 83, column: 14, severity: LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' }
];
const flake8MessagesToBeReturned: ILintMessage[] = [
    { line: 5, column: 1, severity: LintMessageSeverity.Error, code: 'E302', message: 'expected 2 blank lines, found 1', provider: '', type: '' },
    { line: 19, column: 15, severity: LintMessageSeverity.Error, code: 'E127', message: 'continuation line over-indented for visual indent', provider: '', type: '' },
    { line: 24, column: 23, severity: LintMessageSeverity.Error, code: 'E261', message: 'at least two spaces before inline comment', provider: '', type: '' },
    { line: 62, column: 30, severity: LintMessageSeverity.Error, code: 'E261', message: 'at least two spaces before inline comment', provider: '', type: '' },
    { line: 70, column: 22, severity: LintMessageSeverity.Error, code: 'E261', message: 'at least two spaces before inline comment', provider: '', type: '' },
    { line: 80, column: 5, severity: LintMessageSeverity.Error, code: 'E303', message: 'too many blank lines (2)', provider: '', type: '' },
    { line: 87, column: 24, severity: LintMessageSeverity.Warning, code: 'W292', message: 'no newline at end of file', provider: '', type: '' }
];
const pep8MessagesToBeReturned: ILintMessage[] = [
    { line: 5, column: 1, severity: LintMessageSeverity.Error, code: 'E302', message: 'expected 2 blank lines, found 1', provider: '', type: '' },
    { line: 19, column: 15, severity: LintMessageSeverity.Error, code: 'E127', message: 'continuation line over-indented for visual indent', provider: '', type: '' },
    { line: 24, column: 23, severity: LintMessageSeverity.Error, code: 'E261', message: 'at least two spaces before inline comment', provider: '', type: '' },
    { line: 62, column: 30, severity: LintMessageSeverity.Error, code: 'E261', message: 'at least two spaces before inline comment', provider: '', type: '' },
    { line: 70, column: 22, severity: LintMessageSeverity.Error, code: 'E261', message: 'at least two spaces before inline comment', provider: '', type: '' },
    { line: 80, column: 5, severity: LintMessageSeverity.Error, code: 'E303', message: 'too many blank lines (2)', provider: '', type: '' },
    { line: 87, column: 24, severity: LintMessageSeverity.Warning, code: 'W292', message: 'no newline at end of file', provider: '', type: '' }
];
const pydocstyleMessagseToBeReturned: ILintMessage[] = [
    { code: 'D400', severity: LintMessageSeverity.Information, message: 'First line should end with a period (not \'e\')', column: 0, line: 1, type: '', provider: 'pydocstyle' },
    { code: 'D400', severity: LintMessageSeverity.Information, message: 'First line should end with a period (not \'t\')', column: 0, line: 5, type: '', provider: 'pydocstyle' },
    { code: 'D102', severity: LintMessageSeverity.Information, message: 'Missing docstring in public method', column: 4, line: 8, type: '', provider: 'pydocstyle' },
    { code: 'D401', severity: LintMessageSeverity.Information, message: 'First line should be in imperative mood (\'thi\', not \'this\')', column: 4, line: 11, type: '', provider: 'pydocstyle' },
    { code: 'D403', severity: LintMessageSeverity.Information, message: 'First word of the first line should be properly capitalized (\'This\', not \'this\')', column: 4, line: 11, type: '', provider: 'pydocstyle' },
    { code: 'D400', severity: LintMessageSeverity.Information, message: 'First line should end with a period (not \'e\')', column: 4, line: 11, type: '', provider: 'pydocstyle' },
    { code: 'D403', severity: LintMessageSeverity.Information, message: 'First word of the first line should be properly capitalized (\'And\', not \'and\')', column: 4, line: 15, type: '', provider: 'pydocstyle' },
    { code: 'D400', severity: LintMessageSeverity.Information, message: 'First line should end with a period (not \'t\')', column: 4, line: 15, type: '', provider: 'pydocstyle' },
    { code: 'D403', severity: LintMessageSeverity.Information, message: 'First word of the first line should be properly capitalized (\'Test\', not \'test\')', column: 4, line: 21, type: '', provider: 'pydocstyle' },
    { code: 'D400', severity: LintMessageSeverity.Information, message: 'First line should end with a period (not \'g\')', column: 4, line: 21, type: '', provider: 'pydocstyle' },
    { code: 'D403', severity: LintMessageSeverity.Information, message: 'First word of the first line should be properly capitalized (\'Test\', not \'test\')', column: 4, line: 28, type: '', provider: 'pydocstyle' },
    { code: 'D400', severity: LintMessageSeverity.Information, message: 'First line should end with a period (not \'g\')', column: 4, line: 28, type: '', provider: 'pydocstyle' },
    { code: 'D403', severity: LintMessageSeverity.Information, message: 'First word of the first line should be properly capitalized (\'Test\', not \'test\')', column: 4, line: 38, type: '', provider: 'pydocstyle' },
    { code: 'D400', severity: LintMessageSeverity.Information, message: 'First line should end with a period (not \'g\')', column: 4, line: 38, type: '', provider: 'pydocstyle' },
    { code: 'D403', severity: LintMessageSeverity.Information, message: 'First word of the first line should be properly capitalized (\'Test\', not \'test\')', column: 4, line: 53, type: '', provider: 'pydocstyle' },
    { code: 'D400', severity: LintMessageSeverity.Information, message: 'First line should end with a period (not \'g\')', column: 4, line: 53, type: '', provider: 'pydocstyle' },
    { code: 'D403', severity: LintMessageSeverity.Information, message: 'First word of the first line should be properly capitalized (\'Test\', not \'test\')', column: 4, line: 68, type: '', provider: 'pydocstyle' },
    { code: 'D400', severity: LintMessageSeverity.Information, message: 'First line should end with a period (not \'g\')', column: 4, line: 68, type: '', provider: 'pydocstyle' },
    { code: 'D403', severity: LintMessageSeverity.Information, message: 'First word of the first line should be properly capitalized (\'Test\', not \'test\')', column: 4, line: 80, type: '', provider: 'pydocstyle' },
    { code: 'D400', severity: LintMessageSeverity.Information, message: 'First line should end with a period (not \'g\')', column: 4, line: 80, type: '', provider: 'pydocstyle' }
];

const filteredFlake8MessagesToBeReturned: ILintMessage[] = [
    { line: 87, column: 24, severity: LintMessageSeverity.Warning, code: 'W292', message: 'no newline at end of file', provider: '', type: '' }
];
const filteredPep88MessagesToBeReturned: ILintMessage[] = [
    { line: 87, column: 24, severity: LintMessageSeverity.Warning, code: 'W292', message: 'no newline at end of file', provider: '', type: '' }
];

// tslint:disable-next-line:max-func-body-length
suite('Linting - General Tests', () => {
    let ioc: UnitTestIocContainer;
    let linterManager: ILinterManager;
    let configService: IConfigurationService;

    suiteSetup(initialize);
    setup(async () => {
        initializeDI();
        await initializeTest();
        await resetSettings();
    });
    suiteTeardown(closeActiveWindows);
    teardown(async () => {
        ioc.dispose();
        await closeActiveWindows();
        await resetSettings();
        await deleteFile(path.join(workspaceUri.fsPath, '.pylintrc'));
        await deleteFile(path.join(workspaceUri.fsPath, '.pydocstyle'));
    });

    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes(false);
        ioc.registerProcessTypes();
        ioc.registerLinterTypes();
        ioc.registerVariableTypes();
        ioc.registerPlatformTypes();
        linterManager = new LinterManager(ioc.serviceContainer);
        configService = ioc.serviceContainer.get<IConfigurationService>(IConfigurationService);
        ioc.serviceManager.addSingletonInstance<IProductService>(IProductService, new ProductService());
        ioc.serviceManager.addSingleton<IProductPathService>(IProductPathService, CTagsProductPathService, ProductType.WorkspaceSymbols);
        ioc.serviceManager.addSingleton<IProductPathService>(IProductPathService, FormatterProductPathService, ProductType.Formatter);
        ioc.serviceManager.addSingleton<IProductPathService>(IProductPathService, LinterProductPathService, ProductType.Linter);
        ioc.serviceManager.addSingleton<IProductPathService>(IProductPathService, TestFrameworkProductPathService, ProductType.TestFramework);
        ioc.serviceManager.addSingleton<IProductPathService>(IProductPathService, RefactoringLibraryProductPathService, ProductType.RefactoringLibrary);
    }

    async function resetSettings() {
        // Don't run these updates in parallel, as they are updating the same file.
        const target = IS_MULTI_ROOT_TEST ? ConfigurationTarget.WorkspaceFolder : ConfigurationTarget.Workspace;

        await configService.updateSettingAsync('linting.enabled', true, rootWorkspaceUri, target);
        await configService.updateSettingAsync('linting.lintOnSave', false, rootWorkspaceUri, target);
        await configService.updateSettingAsync('linting.pylintUseMinimalCheckers', false, workspaceUri);

        linterManager.getAllLinterInfos().forEach(async (x) => {
            await configService.updateSettingAsync(makeSettingKey(x.product), false, rootWorkspaceUri, target);
        });
    }

    function makeSettingKey(product: Product): PythonSettingKeys {
        return `linting.${linterManager.getLinterInfo(product).enabledSettingName}` as PythonSettingKeys;
    }

    async function testEnablingDisablingOfLinter(product: Product, enabled: boolean, file?: string) {
        const setting = makeSettingKey(product);
        const output = ioc.serviceContainer.get<MockOutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);

        await configService.updateSettingAsync(setting, enabled, rootWorkspaceUri,
            IS_MULTI_ROOT_TEST ? ConfigurationTarget.WorkspaceFolder : ConfigurationTarget.Workspace);

        file = file ? file : fileToLint;
        const document = await workspace.openTextDocument(file);
        const cancelToken = new CancellationTokenSource();

        await linterManager.setActiveLintersAsync([product]);
        await linterManager.enableLintingAsync(enabled);
        const linter = linterManager.createLinter(product, output, ioc.serviceContainer);

        const messages = await linter.lint(document, cancelToken.token);
        if (enabled) {
            assert.notEqual(messages.length, 0, `No linter errors when linter is enabled, Output - ${output.output}`);
        } else {
            assert.equal(messages.length, 0, `Errors returned when linter is disabled, Output - ${output.output}`);
        }
    }

    test('Disable Pylint and test linter', async () => {
        await testEnablingDisablingOfLinter(Product.pylint, false);
    });
    test('Enable Pylint and test linter', async () => {
        await testEnablingDisablingOfLinter(Product.pylint, true);
    });
    test('Disable Pep8 and test linter', async () => {
        await testEnablingDisablingOfLinter(Product.pep8, false);
    });
    test('Enable Pep8 and test linter', async () => {
        await testEnablingDisablingOfLinter(Product.pep8, true);
    });
    test('Disable Flake8 and test linter', async () => {
        await testEnablingDisablingOfLinter(Product.flake8, false);
    });
    test('Enable Flake8 and test linter', async () => {
        await testEnablingDisablingOfLinter(Product.flake8, true);
    });
    test('Disable Prospector and test linter', async () => {
        await testEnablingDisablingOfLinter(Product.prospector, false);
    });
    test('Enable Prospector and test linter', async () => {
        await testEnablingDisablingOfLinter(Product.prospector, true);
    });
    test('Disable Pydocstyle and test linter', async () => {
        await testEnablingDisablingOfLinter(Product.pydocstyle, false);
    });
    test('Enable Pydocstyle and test linter', async () => {
        await testEnablingDisablingOfLinter(Product.pydocstyle, true);
    });

    // tslint:disable-next-line:no-any
    async function testLinterMessages(product: Product, pythonFile: string, messagesToBeReceived: ILintMessage[]): Promise<any> {
        const outputChannel = ioc.serviceContainer.get<MockOutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
        const cancelToken = new CancellationTokenSource();
        const document = await workspace.openTextDocument(pythonFile);

        await linterManager.setActiveLintersAsync([product], document.uri);
        const linter = linterManager.createLinter(product, outputChannel, ioc.serviceContainer);

        const messages = await linter.lint(document, cancelToken.token);
        if (messagesToBeReceived.length === 0) {
            assert.equal(messages.length, 0, `No errors in linter, Output - ${outputChannel.output}`);
        } else {
            if (outputChannel.output.indexOf('ENOENT') === -1) {
                // Pylint for Python Version 2.7 could return 80 linter messages, where as in 3.5 it might only return 1.
                // Looks like pylint stops linting as soon as it comes across any ERRORS.
                assert.notEqual(messages.length, 0, `No errors in linter, Output - ${outputChannel.output}`);
            }
        }
    }
    test('PyLint', async () => {
        await testLinterMessages(Product.pylint, fileToLint, pylintMessagesToBeReturned);
    });
    test('Flake8', async () => {
        await testLinterMessages(Product.flake8, fileToLint, flake8MessagesToBeReturned);
    });
    test('Pep8', async () => {
        await testLinterMessages(Product.pep8, fileToLint, pep8MessagesToBeReturned);
    });
    test('Pydocstyle', async () => {
        await testLinterMessages(Product.pydocstyle, fileToLint, pydocstyleMessagseToBeReturned);
    });
    test('PyLint with config in root', async () => {
        await fs.copy(path.join(pylintConfigPath, '.pylintrc'), path.join(workspaceUri.fsPath, '.pylintrc'));
        await testLinterMessages(Product.pylint, path.join(pylintConfigPath, 'file2.py'), []);
    });
    test('Flake8 with config in root', async () => {
        await testLinterMessages(Product.flake8, path.join(flake8ConfigPath, 'file.py'), filteredFlake8MessagesToBeReturned);
    });
    test('Pep8 with config in root', async () => {
        await testLinterMessages(Product.pep8, path.join(pep8ConfigPath, 'file.py'), filteredPep88MessagesToBeReturned);
    });
    test('Pydocstyle with config in root', async () => {
        await configService.updateSettingAsync('linting.pylintUseMinimalCheckers', false, workspaceUri);
        await fs.copy(path.join(pydocstyleConfigPath27, '.pydocstyle'), path.join(workspaceUri.fsPath, '.pydocstyle'));
        await testLinterMessages(Product.pydocstyle, path.join(pydocstyleConfigPath27, 'file.py'), []);
    });
    test('PyLint minimal checkers', async () => {
        const file = path.join(pythoFilesPath, 'minCheck.py');
        await configService.updateSettingAsync('linting.pylintUseMinimalCheckers', true, workspaceUri);
        await testEnablingDisablingOfLinter(Product.pylint, false, file);
        await configService.updateSettingAsync('linting.pylintUseMinimalCheckers', false, workspaceUri);
        await testEnablingDisablingOfLinter(Product.pylint, true, file);
    });
    // tslint:disable-next-line:no-function-expression
    test('Multiple linters', async function () {
        // tslint:disable-next-line:no-invalid-this
        this.timeout(40000);

        await closeActiveWindows();
        const document = await workspace.openTextDocument(path.join(pythoFilesPath, 'print.py'));
        await window.showTextDocument(document);
        await configService.updateSettingAsync('linting.enabled', true, workspaceUri);
        await configService.updateSettingAsync('linting.pylintUseMinimalCheckers', false, workspaceUri);
        await configService.updateSettingAsync('linting.pylintEnabled', true, workspaceUri);
        await configService.updateSettingAsync('linting.flake8Enabled', true, workspaceUri);

        const commands = ioc.serviceContainer.get<ICommandManager>(ICommandManager);
        const collection = await commands.executeCommand('python.runLinting') as DiagnosticCollection;
        assert.notEqual(collection, undefined, 'python.runLinting did not return valid diagnostics collection.');

        const messages = collection!.get(document.uri);
        assert.notEqual(messages!.length, 0, 'No diagnostic messages.');
        assert.notEqual(messages!.filter(x => x.source === 'pylint').length, 0, 'No pylint messages.');
        assert.notEqual(messages!.filter(x => x.source === 'flake8').length, 0, 'No flake8 messages.');
    });
    // tslint:disable-next-line:no-any
    async function testLinterMessageCount(product: Product, pythonFile: string, messageCountToBeReceived: number): Promise<any> {
        const outputChannel = ioc.serviceContainer.get<MockOutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
        const cancelToken = new CancellationTokenSource();
        const document = await workspace.openTextDocument(pythonFile);

        await linterManager.setActiveLintersAsync([product], document.uri);
        const linter = linterManager.createLinter(product, outputChannel, ioc.serviceContainer);

        const messages = await linter.lint(document, cancelToken.token);
        assert.equal(messages.length, messageCountToBeReceived, 'Expected number of lint errors does not match lint error count');
    }
    test('Three line output counted as one message', async () => {
        const maxErrors = 5;
        const target = IS_MULTI_ROOT_TEST ? ConfigurationTarget.WorkspaceFolder : ConfigurationTarget.Workspace;
        await configService.updateSettingAsync('linting.maxNumberOfProblems', maxErrors, rootWorkspaceUri, target);
        await testLinterMessageCount(Product.pylint, threeLinLintsPath, maxErrors);
    });
});
