import * as assert from 'assert';
import * as fs from 'fs-extra';
import * as path from 'path';
import { OutputChannel, Uri } from 'vscode';
import * as vscode from 'vscode';
import { STANDARD_OUTPUT_CHANNEL } from '../../client/common/constants';
import { Installer, Product, SettingToDisableProduct } from '../../client/common/installer/installer';
import { IInstaller, ILogger, IOutputChannel } from '../../client/common/types';
import { IServiceContainer } from '../../client/ioc/types';
import { BaseLinter } from '../../client/linters/baseLinter';
import * as baseLinter from '../../client/linters/baseLinter';
import * as flake8 from '../../client/linters/flake8';
import * as pep8 from '../../client/linters/pep8Linter';
import * as prospector from '../../client/linters/prospector';
import * as pydocstyle from '../../client/linters/pydocstyle';
import * as pyLint from '../../client/linters/pylint';
import { ILinterHelper } from '../../client/linters/types';
import { deleteFile, PythonSettingKeys, rootWorkspaceUri, updateSetting } from '../common';
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

const pylintMessagesToBeReturned: baseLinter.ILintMessage[] = [
    { line: 24, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', provider: '', type: '' },
    { line: 30, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', provider: '', type: '' },
    { line: 34, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: 'I0012', message: 'Locally enabling no-member (E1101)', provider: '', type: '' },
    { line: 40, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', provider: '', type: '' },
    { line: 44, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: 'I0012', message: 'Locally enabling no-member (E1101)', provider: '', type: '' },
    { line: 55, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', provider: '', type: '' },
    { line: 59, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: 'I0012', message: 'Locally enabling no-member (E1101)', provider: '', type: '' },
    { line: 62, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling undefined-variable (E0602)', provider: '', type: '' },
    { line: 70, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', provider: '', type: '' },
    { line: 84, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', provider: '', type: '' },
    { line: 87, column: 0, severity: baseLinter.LintMessageSeverity.Hint, code: 'C0304', message: 'Final newline missing', provider: '', type: '' },
    { line: 11, column: 20, severity: baseLinter.LintMessageSeverity.Warning, code: 'W0613', message: 'Unused argument \'arg\'', provider: '', type: '' },
    { line: 26, column: 14, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blop\' member', provider: '', type: '' },
    { line: 36, column: 14, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 46, column: 18, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 61, column: 18, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 72, column: 18, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 75, column: 18, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 77, column: 14, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 83, column: 14, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' }
];
const flake8MessagesToBeReturned: baseLinter.ILintMessage[] = [
    { line: 5, column: 1, severity: baseLinter.LintMessageSeverity.Error, code: 'E302', message: 'expected 2 blank lines, found 1', provider: '', type: '' },
    { line: 19, column: 15, severity: baseLinter.LintMessageSeverity.Error, code: 'E127', message: 'continuation line over-indented for visual indent', provider: '', type: '' },
    { line: 24, column: 23, severity: baseLinter.LintMessageSeverity.Error, code: 'E261', message: 'at least two spaces before inline comment', provider: '', type: '' },
    { line: 62, column: 30, severity: baseLinter.LintMessageSeverity.Error, code: 'E261', message: 'at least two spaces before inline comment', provider: '', type: '' },
    { line: 70, column: 22, severity: baseLinter.LintMessageSeverity.Error, code: 'E261', message: 'at least two spaces before inline comment', provider: '', type: '' },
    { line: 80, column: 5, severity: baseLinter.LintMessageSeverity.Error, code: 'E303', message: 'too many blank lines (2)', provider: '', type: '' },
    { line: 87, column: 24, severity: baseLinter.LintMessageSeverity.Warning, code: 'W292', message: 'no newline at end of file', provider: '', type: '' }
];
const pep8MessagesToBeReturned: baseLinter.ILintMessage[] = [
    { line: 5, column: 1, severity: baseLinter.LintMessageSeverity.Error, code: 'E302', message: 'expected 2 blank lines, found 1', provider: '', type: '' },
    { line: 19, column: 15, severity: baseLinter.LintMessageSeverity.Error, code: 'E127', message: 'continuation line over-indented for visual indent', provider: '', type: '' },
    { line: 24, column: 23, severity: baseLinter.LintMessageSeverity.Error, code: 'E261', message: 'at least two spaces before inline comment', provider: '', type: '' },
    { line: 62, column: 30, severity: baseLinter.LintMessageSeverity.Error, code: 'E261', message: 'at least two spaces before inline comment', provider: '', type: '' },
    { line: 70, column: 22, severity: baseLinter.LintMessageSeverity.Error, code: 'E261', message: 'at least two spaces before inline comment', provider: '', type: '' },
    { line: 80, column: 5, severity: baseLinter.LintMessageSeverity.Error, code: 'E303', message: 'too many blank lines (2)', provider: '', type: '' },
    { line: 87, column: 24, severity: baseLinter.LintMessageSeverity.Warning, code: 'W292', message: 'no newline at end of file', provider: '', type: '' }
];
const pydocstyleMessagseToBeReturned: baseLinter.ILintMessage[] = [
    { code: 'D400', severity: baseLinter.LintMessageSeverity.Information, message: 'First line should end with a period (not \'e\')', column: 0, line: 1, type: '', provider: 'pydocstyle' },
    { code: 'D400', severity: baseLinter.LintMessageSeverity.Information, message: 'First line should end with a period (not \'t\')', column: 0, line: 5, type: '', provider: 'pydocstyle' },
    { code: 'D102', severity: baseLinter.LintMessageSeverity.Information, message: 'Missing docstring in public method', column: 4, line: 8, type: '', provider: 'pydocstyle' },
    { code: 'D401', severity: baseLinter.LintMessageSeverity.Information, message: 'First line should be in imperative mood (\'thi\', not \'this\')', column: 4, line: 11, type: '', provider: 'pydocstyle' },
    { code: 'D403', severity: baseLinter.LintMessageSeverity.Information, message: 'First word of the first line should be properly capitalized (\'This\', not \'this\')', column: 4, line: 11, type: '', provider: 'pydocstyle' },
    { code: 'D400', severity: baseLinter.LintMessageSeverity.Information, message: 'First line should end with a period (not \'e\')', column: 4, line: 11, type: '', provider: 'pydocstyle' },
    { code: 'D403', severity: baseLinter.LintMessageSeverity.Information, message: 'First word of the first line should be properly capitalized (\'And\', not \'and\')', column: 4, line: 15, type: '', provider: 'pydocstyle' },
    { code: 'D400', severity: baseLinter.LintMessageSeverity.Information, message: 'First line should end with a period (not \'t\')', column: 4, line: 15, type: '', provider: 'pydocstyle' },
    { code: 'D403', severity: baseLinter.LintMessageSeverity.Information, message: 'First word of the first line should be properly capitalized (\'Test\', not \'test\')', column: 4, line: 21, type: '', provider: 'pydocstyle' },
    { code: 'D400', severity: baseLinter.LintMessageSeverity.Information, message: 'First line should end with a period (not \'g\')', column: 4, line: 21, type: '', provider: 'pydocstyle' },
    { code: 'D403', severity: baseLinter.LintMessageSeverity.Information, message: 'First word of the first line should be properly capitalized (\'Test\', not \'test\')', column: 4, line: 28, type: '', provider: 'pydocstyle' },
    { code: 'D400', severity: baseLinter.LintMessageSeverity.Information, message: 'First line should end with a period (not \'g\')', column: 4, line: 28, type: '', provider: 'pydocstyle' },
    { code: 'D403', severity: baseLinter.LintMessageSeverity.Information, message: 'First word of the first line should be properly capitalized (\'Test\', not \'test\')', column: 4, line: 38, type: '', provider: 'pydocstyle' },
    { code: 'D400', severity: baseLinter.LintMessageSeverity.Information, message: 'First line should end with a period (not \'g\')', column: 4, line: 38, type: '', provider: 'pydocstyle' },
    { code: 'D403', severity: baseLinter.LintMessageSeverity.Information, message: 'First word of the first line should be properly capitalized (\'Test\', not \'test\')', column: 4, line: 53, type: '', provider: 'pydocstyle' },
    { code: 'D400', severity: baseLinter.LintMessageSeverity.Information, message: 'First line should end with a period (not \'g\')', column: 4, line: 53, type: '', provider: 'pydocstyle' },
    { code: 'D403', severity: baseLinter.LintMessageSeverity.Information, message: 'First word of the first line should be properly capitalized (\'Test\', not \'test\')', column: 4, line: 68, type: '', provider: 'pydocstyle' },
    { code: 'D400', severity: baseLinter.LintMessageSeverity.Information, message: 'First line should end with a period (not \'g\')', column: 4, line: 68, type: '', provider: 'pydocstyle' },
    { code: 'D403', severity: baseLinter.LintMessageSeverity.Information, message: 'First word of the first line should be properly capitalized (\'Test\', not \'test\')', column: 4, line: 80, type: '', provider: 'pydocstyle' },
    { code: 'D400', severity: baseLinter.LintMessageSeverity.Information, message: 'First line should end with a period (not \'g\')', column: 4, line: 80, type: '', provider: 'pydocstyle' }
];

const filteredFlake8MessagesToBeReturned: baseLinter.ILintMessage[] = [
    { line: 87, column: 24, severity: baseLinter.LintMessageSeverity.Warning, code: 'W292', message: 'no newline at end of file', provider: '', type: '' }
];
const filteredPep88MessagesToBeReturned: baseLinter.ILintMessage[] = [
    { line: 87, column: 24, severity: baseLinter.LintMessageSeverity.Warning, code: 'W292', message: 'no newline at end of file', provider: '', type: '' }
];

// tslint:disable-next-line:max-func-body-length
suite('Linting', () => {
    let ioc: UnitTestIocContainer;
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
        ioc.registerCommonTypes();
        ioc.registerProcessTypes();
        ioc.registerLinterTypes();
        ioc.registerVariableTypes();
    }

    type LinterCtor = { new(outputChannel: OutputChannel, installer: IInstaller, helper: ILinterHelper, logger: ILogger, serviceContainer: IServiceContainer): BaseLinter };
    function createLinter(linter: Product) {
        const mockOutputChannel = ioc.serviceManager.get<OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
        const installer = ioc.serviceContainer.get<IInstaller>(IInstaller);
        const logger = ioc.serviceContainer.get<ILogger>(ILogger);
        const linterHelper = ioc.serviceContainer.get<ILinterHelper>(ILinterHelper);

        let linterCtor: LinterCtor;
        switch (linter) {
            case Product.pylint: {
                linterCtor = pyLint.Linter;
                break;
            }
            case Product.flake8: {
                linterCtor = flake8.Linter;
                break;
            }
            case Product.pep8: {
                linterCtor = pep8.Linter;
                break;
            }
            case Product.prospector: {
                linterCtor = prospector.Linter;
                break;
            }
            case Product.pydocstyle: {
                linterCtor = pydocstyle.Linter;
                break;
            }
            default: {
                throw new Error('Not implemented for the unit tests');
            }
        }

        if (linterCtor) {
            return new linterCtor(mockOutputChannel, installer, linterHelper, logger, ioc.serviceContainer);
        }
    }
    async function resetSettings() {
        // Don't run these updates in parallel, as they are updating the same file.
        await updateSetting('linting.enabled', true, rootWorkspaceUri, vscode.ConfigurationTarget.Workspace);
        if (IS_MULTI_ROOT_TEST) {
            await updateSetting('linting.enabled', true, rootWorkspaceUri, vscode.ConfigurationTarget.WorkspaceFolder);
        }
        await updateSetting('linting.lintOnSave', false, rootWorkspaceUri, vscode.ConfigurationTarget.Workspace);
        await updateSetting('linting.pylintEnabled', false, rootWorkspaceUri, vscode.ConfigurationTarget.Workspace);
        await updateSetting('linting.flake8Enabled', false, rootWorkspaceUri, vscode.ConfigurationTarget.Workspace);
        await updateSetting('linting.pep8Enabled', false, rootWorkspaceUri, vscode.ConfigurationTarget.Workspace);
        await updateSetting('linting.prospectorEnabled', false, rootWorkspaceUri, vscode.ConfigurationTarget.Workspace);
        await updateSetting('linting.mypyEnabled', false, rootWorkspaceUri, vscode.ConfigurationTarget.Workspace);
        await updateSetting('linting.pydocstyleEnabled', false, rootWorkspaceUri, vscode.ConfigurationTarget.Workspace);
        await updateSetting('linting.pylamaEnabled', false, rootWorkspaceUri, vscode.ConfigurationTarget.Workspace);

        if (IS_MULTI_ROOT_TEST) {
            await updateSetting('linting.lintOnSave', false, rootWorkspaceUri, vscode.ConfigurationTarget.WorkspaceFolder);
            await updateSetting('linting.pylintEnabled', false, rootWorkspaceUri, vscode.ConfigurationTarget.WorkspaceFolder);
            await updateSetting('linting.flake8Enabled', false, rootWorkspaceUri, vscode.ConfigurationTarget.WorkspaceFolder);
            await updateSetting('linting.pep8Enabled', false, rootWorkspaceUri, vscode.ConfigurationTarget.WorkspaceFolder);
            await updateSetting('linting.prospectorEnabled', false, rootWorkspaceUri, vscode.ConfigurationTarget.WorkspaceFolder);
            await updateSetting('linting.mypyEnabled', false, rootWorkspaceUri, vscode.ConfigurationTarget.WorkspaceFolder);
            await updateSetting('linting.pydocstyleEnabled', false, rootWorkspaceUri, vscode.ConfigurationTarget.WorkspaceFolder);
            await updateSetting('linting.pylamaEnabled', false, rootWorkspaceUri, vscode.ConfigurationTarget.WorkspaceFolder);
        }
    }
    async function testEnablingDisablingOfLinter(product: Product, setting: PythonSettingKeys, enabled: boolean) {
        const linter = createLinter(product)!;
        const output = ioc.serviceContainer.get<MockOutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
        await updateSetting(setting, enabled, rootWorkspaceUri, IS_MULTI_ROOT_TEST ? vscode.ConfigurationTarget.WorkspaceFolder : vscode.ConfigurationTarget.Workspace);
        const document = await vscode.workspace.openTextDocument(fileToLint);
        const cancelToken = new vscode.CancellationTokenSource();
        const messages = await linter.lint(document, cancelToken.token);
        if (enabled) {
            assert.notEqual(messages.length, 0, `No linter errors when linter is enabled, Output - ${output.output}`);
        } else {
            assert.equal(messages.length, 0, `Errors returned when linter is disabled, Output - ${output.output}`);
        }
    }
    test('Disable Pylint and test linter', async () => {
        await testEnablingDisablingOfLinter(Product.pylint, 'linting.pylintEnabled', false);
    });
    test('Enable Pylint and test linter', async () => {
        await testEnablingDisablingOfLinter(Product.pylint, 'linting.pylintEnabled', true);
    });
    test('Disable Pep8 and test linter', async () => {
        await testEnablingDisablingOfLinter(Product.pep8, 'linting.pep8Enabled', false);
    });
    test('Enable Pep8 and test linter', async () => {
        await testEnablingDisablingOfLinter(Product.pep8, 'linting.pep8Enabled', true);
    });
    test('Disable Flake8 and test linter', async () => {
        await testEnablingDisablingOfLinter(Product.flake8, 'linting.flake8Enabled', false);
    });
    test('Enable Flake8 and test linter', async () => {
        await testEnablingDisablingOfLinter(Product.flake8, 'linting.flake8Enabled', true);
    });
    test('Disable Prospector and test linter', async () => {
        await testEnablingDisablingOfLinter(Product.prospector, 'linting.prospectorEnabled', false);
    });
    test('Disable Pydocstyle and test linter', async () => {
        await testEnablingDisablingOfLinter(Product.pydocstyle, 'linting.pydocstyleEnabled', false);
    });
    test('Enable Pydocstyle and test linter', async () => {
        await testEnablingDisablingOfLinter(Product.pydocstyle, 'linting.pydocstyleEnabled', true);
    });

    // tslint:disable-next-line:no-any
    async function testLinterMessages(product: Product, pythonFile: string, messagesToBeReceived: baseLinter.ILintMessage[]): Promise<any> {
        const linter = createLinter(product)!;
        const outputChannel = ioc.serviceContainer.get<MockOutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
        const cancelToken = new vscode.CancellationTokenSource();
        const settingToEnable = SettingToDisableProduct.get(linter.product);
        // tslint:disable-next-line:no-any prefer-type-cast
        await updateSetting(settingToEnable as any, true, rootWorkspaceUri, IS_MULTI_ROOT_TEST ? vscode.ConfigurationTarget.WorkspaceFolder : vscode.ConfigurationTarget.Workspace);
        const document = await vscode.workspace.openTextDocument(pythonFile);
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
        await testLinterMessages(Product.pylint, path.join(pylintConfigPath, 'file.py'), []);
    });
    test('Flake8 with config in root', async () => {
        await testLinterMessages(Product.flake8, path.join(flake8ConfigPath, 'file.py'), filteredFlake8MessagesToBeReturned);
    });
    test('Pep8 with config in root', async () => {
        await testLinterMessages(Product.pep8, path.join(pep8ConfigPath, 'file.py'), filteredPep88MessagesToBeReturned);
    });
    test('Pydocstyle with config in root', async () => {
        await fs.copy(path.join(pydocstyleConfigPath27, '.pydocstyle'), path.join(workspaceUri.fsPath, '.pydocstyle'));
        await testLinterMessages(Product.pydocstyle, path.join(pydocstyleConfigPath27, 'file.py'), []);
    });
});
