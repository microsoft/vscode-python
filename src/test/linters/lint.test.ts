import * as assert from 'assert';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { PythonSettings } from '../../client/common/configSettings';
import { createDeferred } from '../../client/common/helpers';
import { SettingToDisableProduct } from '../../client/common/installer';
import { execPythonFile } from '../../client/common/utils';
import * as baseLinter from '../../client/linters/baseLinter';
import * as flake8 from '../../client/linters/flake8';
import * as pep8 from '../../client/linters/pep8Linter';
import * as prospector from '../../client/linters/prospector';
import * as pydocstyle from '../../client/linters/pydocstyle';
import * as pyLint from '../../client/linters/pylint';
import { PythonSettingKeys, rootWorkspaceUri, updateSetting } from '../common';
import { closeActiveWindows, initialize, initializeTest, IS_MULTI_ROOT_TEST } from '../initialize';
import { MockOutputChannel } from '../mockClasses';

const pythoFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'linting');
const flake8ConfigPath = path.join(pythoFilesPath, 'flake8config');
const pep8ConfigPath = path.join(pythoFilesPath, 'pep8config');
const pydocstyleConfigPath27 = path.join(pythoFilesPath, 'pydocstyleconfig27');
const pylintConfigPath = path.join(pythoFilesPath, 'pylintconfig');
const fileToLint = path.join(pythoFilesPath, 'file.py');
let pylintFileToLintLines: string[] = [];

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

const filteredPylintMessagesToBeReturned: baseLinter.ILintMessage[] = [
    { line: 26, column: 14, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blop\' member', provider: '', type: '' },
    { line: 36, column: 14, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 46, column: 18, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 61, column: 18, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 72, column: 18, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 75, column: 18, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 77, column: 14, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 83, column: 14, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' }
];
const filteredPylint3MessagesToBeReturned: baseLinter.ILintMessage[] = [
];
const filteredFlake8MessagesToBeReturned: baseLinter.ILintMessage[] = [
    { line: 87, column: 24, severity: baseLinter.LintMessageSeverity.Warning, code: 'W292', message: 'no newline at end of file', provider: '', type: '' }
];
const filteredPep88MessagesToBeReturned: baseLinter.ILintMessage[] = [
    { line: 87, column: 24, severity: baseLinter.LintMessageSeverity.Warning, code: 'W292', message: 'no newline at end of file', provider: '', type: '' }
];
const fiteredPydocstyleMessagseToBeReturned: baseLinter.ILintMessage[] = [
    { code: 'D102', severity: baseLinter.LintMessageSeverity.Information, message: 'Missing docstring in public method', column: 4, line: 8, type: '', provider: 'pydocstyle' }
];

// tslint:disable-next-line:max-func-body-length
suite('Linting', () => {
    const isPython3Deferred = createDeferred<boolean>();
    const isPython3 = isPython3Deferred.promise;
    suiteSetup(async () => {
        pylintFileToLintLines = fs.readFileSync(fileToLint).toString('utf-8').split(/\r?\n/g);
        await initialize();
        const version = await execPythonFile(fileToLint, PythonSettings.getInstance(vscode.Uri.file(fileToLint)).pythonPath, ['--version'], __dirname, true);
        isPython3Deferred.resolve(version.indexOf('3.') >= 0);
    });
    setup(async () => {
        await initializeTest();
        await resetSettings();
    });
    suiteTeardown(closeActiveWindows);
    teardown(async () => {
        await closeActiveWindows();
        await resetSettings();
    });
    async function resetSettings() {
        // Don't run these updates in parallel, as they are updating the same file.
        await updateSetting('linting.enabled', true, rootWorkspaceUri, vscode.ConfigurationTarget.Workspace);
        if (IS_MULTI_ROOT_TEST) {
            await updateSetting('linting.enabled', true, rootWorkspaceUri, vscode.ConfigurationTarget.WorkspaceFolder);
        }
        await updateSetting('linting.lintOnSave', false, rootWorkspaceUri, vscode.ConfigurationTarget.Workspace);
        await updateSetting('linting.lintOnTextChange', false, rootWorkspaceUri, vscode.ConfigurationTarget.Workspace);
        await updateSetting('linting.pylintEnabled', false, rootWorkspaceUri, vscode.ConfigurationTarget.Workspace);
        await updateSetting('linting.flake8Enabled', false, rootWorkspaceUri, vscode.ConfigurationTarget.Workspace);
        await updateSetting('linting.pep8Enabled', false, rootWorkspaceUri, vscode.ConfigurationTarget.Workspace);
        await updateSetting('linting.prospectorEnabled', false, rootWorkspaceUri, vscode.ConfigurationTarget.Workspace);
        await updateSetting('linting.mypyEnabled', false, rootWorkspaceUri, vscode.ConfigurationTarget.Workspace);
        await updateSetting('linting.pydocstyleEnabled', false, rootWorkspaceUri, vscode.ConfigurationTarget.Workspace);
        await updateSetting('linting.pylamaEnabled', false, rootWorkspaceUri, vscode.ConfigurationTarget.Workspace);

        if (IS_MULTI_ROOT_TEST) {
            await updateSetting('linting.lintOnSave', false, rootWorkspaceUri, vscode.ConfigurationTarget.WorkspaceFolder);
            await updateSetting('linting.lintOnTextChange', false, rootWorkspaceUri, vscode.ConfigurationTarget.WorkspaceFolder);
            await updateSetting('linting.pylintEnabled', false, rootWorkspaceUri, vscode.ConfigurationTarget.WorkspaceFolder);
            await updateSetting('linting.flake8Enabled', false, rootWorkspaceUri, vscode.ConfigurationTarget.WorkspaceFolder);
            await updateSetting('linting.pep8Enabled', false, rootWorkspaceUri, vscode.ConfigurationTarget.WorkspaceFolder);
            await updateSetting('linting.prospectorEnabled', false, rootWorkspaceUri, vscode.ConfigurationTarget.WorkspaceFolder);
            await updateSetting('linting.mypyEnabled', false, rootWorkspaceUri, vscode.ConfigurationTarget.WorkspaceFolder);
            await updateSetting('linting.pydocstyleEnabled', false, rootWorkspaceUri, vscode.ConfigurationTarget.WorkspaceFolder);
            await updateSetting('linting.pylamaEnabled', false, rootWorkspaceUri, vscode.ConfigurationTarget.WorkspaceFolder);
        }
    }
    async function testEnablingDisablingOfLinter(linter: baseLinter.BaseLinter, setting: PythonSettingKeys, enabled: boolean, output: MockOutputChannel) {
        await updateSetting(setting, enabled, rootWorkspaceUri, IS_MULTI_ROOT_TEST ? vscode.ConfigurationTarget.WorkspaceFolder : vscode.ConfigurationTarget.Workspace);
        const document = await vscode.workspace.openTextDocument(fileToLint);
        const editor = await vscode.window.showTextDocument(document);
        const cancelToken = new vscode.CancellationTokenSource();
        const messages = await linter.lint(editor.document, cancelToken.token);
        if (enabled) {
            assert.notEqual(messages.length, 0, `No linter errors when linter is enabled, Output - ${output.output}`);
        }
        else {
            assert.equal(messages.length, 0, `Errors returned when linter is disabled, Output - ${output.output}`);
        }
    }
    test('Disable Pylint and test linter', async () => {
        const ch = new MockOutputChannel('Lint');
        await testEnablingDisablingOfLinter(new pyLint.Linter(ch), 'linting.pylintEnabled', false, ch);
    });
    test('Enable Pylint and test linter', async () => {
        const ch = new MockOutputChannel('Lint');
        await testEnablingDisablingOfLinter(new pyLint.Linter(ch), 'linting.pylintEnabled', true, ch);
    });
    test('Disable Pep8 and test linter', async () => {
        const ch = new MockOutputChannel('Lint');
        await testEnablingDisablingOfLinter(new pep8.Linter(ch), 'linting.pep8Enabled', false, ch);
    });
    test('Enable Pep8 and test linter', async () => {
        const ch = new MockOutputChannel('Lint');
        await testEnablingDisablingOfLinter(new pep8.Linter(ch), 'linting.pep8Enabled', true, ch);
    });
    test('Disable Flake8 and test linter', async () => {
        const ch = new MockOutputChannel('Lint');
        await testEnablingDisablingOfLinter(new flake8.Linter(ch), 'linting.flake8Enabled', false, ch);
    });
    test('Enable Flake8 and test linter', async () => {
        const ch = new MockOutputChannel('Lint');
        await testEnablingDisablingOfLinter(new flake8.Linter(ch), 'linting.flake8Enabled', true, ch);
    });
    test('Disable Prospector and test linter', async () => {
        const ch = new MockOutputChannel('Lint');
        await testEnablingDisablingOfLinter(new prospector.Linter(ch), 'linting.prospectorEnabled', false, ch);
    });
    test('Disable Pydocstyle and test linter', async () => {
        const ch = new MockOutputChannel('Lint');
        await testEnablingDisablingOfLinter(new pydocstyle.Linter(ch), 'linting.pydocstyleEnabled', false, ch);
    });
    test('Enable Pydocstyle and test linter', async () => {
        const ch = new MockOutputChannel('Lint');
        await testEnablingDisablingOfLinter(new pydocstyle.Linter(ch), 'linting.pydocstyleEnabled', true, ch);
    });

    // tslint:disable-next-line:no-any
    async function testLinterMessages(linter: baseLinter.BaseLinter, outputChannel: MockOutputChannel, pythonFile: string, messagesToBeReceived: baseLinter.ILintMessage[]): Promise<any> {
        const cancelToken = new vscode.CancellationTokenSource();
        const settingToEnable = SettingToDisableProduct.get(linter.product);
        // tslint:disable-next-line:no-any prefer-type-cast
        await updateSetting(settingToEnable as any, true, rootWorkspaceUri, IS_MULTI_ROOT_TEST ? vscode.ConfigurationTarget.WorkspaceFolder : vscode.ConfigurationTarget.Workspace);
        const document = await vscode.workspace.openTextDocument(pythonFile);
        const editor = await vscode.window.showTextDocument(document);
        const messages = await linter.lint(editor.document, cancelToken.token);
        if (messagesToBeReceived.length === 0) {
            assert.equal(messages.length, 0, `No errors in linter, Output - ${outputChannel.output}`);
        }
        else {
            if (outputChannel.output.indexOf('ENOENT') === -1) {
                // Pylint for Python Version 2.7 could return 80 linter messages, where as in 3.5 it might only return 1.
                // Looks like pylint stops linting as soon as it comes across any ERRORS.
                assert.notEqual(messages.length, 0, `No errors in linter, Output - ${outputChannel.output}`);
            }
        }
    }
    test('PyLint', async () => {
        const ch = new MockOutputChannel('Lint');
        const linter = new pyLint.Linter(ch);
        await testLinterMessages(linter, ch, fileToLint, pylintMessagesToBeReturned);
    });
    test('Flake8', async () => {
        const ch = new MockOutputChannel('Lint');
        const linter = new flake8.Linter(ch);
        await testLinterMessages(linter, ch, fileToLint, flake8MessagesToBeReturned);
    });
    test('Pep8', async () => {
        const ch = new MockOutputChannel('Lint');
        const linter = new pep8.Linter(ch);
        await testLinterMessages(linter, ch, fileToLint, pep8MessagesToBeReturned);
    });
    test('Pydocstyle', async () => {
        const ch = new MockOutputChannel('Lint');
        const linter = new pydocstyle.Linter(ch);
        await testLinterMessages(linter, ch, fileToLint, pydocstyleMessagseToBeReturned);
    });
    // tslint:disable-next-line:no-floating-promises
    isPython3.then(value => {
        const messagesToBeReturned = value ? filteredPylint3MessagesToBeReturned : filteredPylintMessagesToBeReturned;
        test('PyLint with config in root', async () => {
            const ch = new MockOutputChannel('Lint');
            const linter = new pyLint.Linter(ch);
            await testLinterMessages(linter, ch, path.join(pylintConfigPath, 'file.py'), messagesToBeReturned);
        });
    });
    test('Flake8 with config in root', async () => {
        const ch = new MockOutputChannel('Lint');
        const linter = new flake8.Linter(ch);
        await testLinterMessages(linter, ch, path.join(flake8ConfigPath, 'file.py'), filteredFlake8MessagesToBeReturned);
    });
    test('Pep8 with config in root', async () => {
        const ch = new MockOutputChannel('Lint');
        const linter = new pep8.Linter(ch);
        await testLinterMessages(linter, ch, path.join(pep8ConfigPath, 'file.py'), filteredPep88MessagesToBeReturned);
    });
    // tslint:disable-next-line:no-floating-promises
    isPython3.then(value => {
        const messagesToBeReturned = value ? [] : fiteredPydocstyleMessagseToBeReturned;
        test('Pydocstyle with config in root', async () => {
            const ch = new MockOutputChannel('Lint');
            const linter = new pydocstyle.Linter(ch);
            await testLinterMessages(linter, ch, path.join(pydocstyleConfigPath27, 'file.py'), messagesToBeReturned);
        });
    });
});
