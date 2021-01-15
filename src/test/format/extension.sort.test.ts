import * as assert from 'assert';
import { expect } from 'chai';
import * as fs from 'fs';
import { EOL } from 'os';
import * as path from 'path';
import { instance, mock } from 'ts-mockito';
import { commands, ConfigurationTarget, Position, Range, Uri, window, workspace } from 'vscode';
import { Commands } from '../../client/common/constants';
import { ICondaService, IInterpreterService } from '../../client/interpreter/contracts';
import { InterpreterService } from '../../client/interpreter/interpreterService';
import { SortImportsEditingProvider } from '../../client/providers/importSortProvider';
import { ISortImportsEditingProvider } from '../../client/providers/types';
import { CondaService } from '../../client/pythonEnvironments/discovery/locators/services/condaService';
import { updateSetting } from '../common';
import { closeActiveWindows, initialize, initializeTest, IS_MULTI_ROOT_TEST, TEST_TIMEOUT } from '../initialize';
import { UnitTestIocContainer } from '../testing/serviceRegistry';

const sortingPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'sorting');
const fileToFormatWithoutConfig = path.join(sortingPath, 'noconfig', 'before.py');
const originalFileToFormatWithoutConfig = path.join(sortingPath, 'noconfig', 'original.py');
const fileToFormatWithConfig = path.join(sortingPath, 'withconfig', 'before.py');
const originalFileToFormatWithConfig = path.join(sortingPath, 'withconfig', 'original.py');
const fileToFormatWithConfig1 = path.join(sortingPath, 'withconfig', 'before.1.py');
const originalFileToFormatWithConfig1 = path.join(sortingPath, 'withconfig', 'original.1.py');

suite('Sorting', () => {
    let ioc: UnitTestIocContainer;
    let sorter: ISortImportsEditingProvider;
    const configTarget = IS_MULTI_ROOT_TEST ? ConfigurationTarget.WorkspaceFolder : ConfigurationTarget.Workspace;
    suiteSetup(async function () {
        const pythonVersion = process.env.CI_PYTHON_VERSION ? parseFloat(process.env.CI_PYTHON_VERSION) : undefined;
        if (pythonVersion && pythonVersion < 3) {
            return this.skip();
        }
        await initialize();

        return undefined;
    });
    suiteTeardown(async () => {
        fs.writeFileSync(fileToFormatWithConfig, fs.readFileSync(originalFileToFormatWithConfig));
        fs.writeFileSync(fileToFormatWithConfig1, fs.readFileSync(originalFileToFormatWithConfig1));
        fs.writeFileSync(fileToFormatWithoutConfig, fs.readFileSync(originalFileToFormatWithoutConfig));
        await updateSetting('sortImports.args', [], Uri.file(sortingPath), configTarget);
        await closeActiveWindows();
    });
    setup(async function () {
        this.timeout(TEST_TIMEOUT * 2);
        await initializeTest();
        await initializeDI();
        fs.writeFileSync(fileToFormatWithConfig, fs.readFileSync(originalFileToFormatWithConfig));
        fs.writeFileSync(fileToFormatWithoutConfig, fs.readFileSync(originalFileToFormatWithoutConfig));
        fs.writeFileSync(fileToFormatWithConfig1, fs.readFileSync(originalFileToFormatWithConfig1));
        await updateSetting('sortImports.args', [], Uri.file(sortingPath), configTarget);
        await closeActiveWindows();
        sorter = new SortImportsEditingProvider(ioc.serviceContainer);
    });
    teardown(async () => {
        await ioc.dispose();
        await closeActiveWindows();
    });
    async function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerVariableTypes();
        ioc.registerProcessTypes();
        ioc.registerInterpreterStorageTypes();
        await ioc.registerMockInterpreterTypes();
        ioc.serviceManager.rebindInstance<ICondaService>(ICondaService, instance(mock(CondaService)));
        ioc.serviceManager.rebindInstance<IInterpreterService>(IInterpreterService, instance(mock(InterpreterService)));
    }
    test('Without Config', async () => {
        const textDocument = await workspace.openTextDocument(fileToFormatWithoutConfig);
        await window.showTextDocument(textDocument);
        const edit = (await sorter.provideDocumentSortImportsEdits(textDocument.uri))!;
        expect(edit.entries()).to.be.lengthOf(1);
        const edits = edit.entries()[0][1];
        expect(edits.length).to.equal(4);
        assert.equal(
            edits.filter((value) => value.newText === EOL && value.range.isEqual(new Range(2, 0, 2, 0))).length,
            1,
            'EOL not found',
        );
        assert.equal(
            edits.filter((value) => value.newText === '' && value.range.isEqual(new Range(3, 0, 4, 0))).length,
            1,
            '"" not found',
        );
        assert.equal(
            edits.filter(
                (value) =>
                    value.newText === `from rope.refactor.extract import ExtractMethod, ExtractVariable${EOL}` &&
                    value.range.isEqual(new Range(15, 0, 15, 0)),
            ).length,
            1,
            'Text not found',
        );
        assert.equal(
            edits.filter((value) => value.newText === '' && value.range.isEqual(new Range(16, 0, 18, 0))).length,
            1,
            '"" not found',
        );
    });

    test('Without Config (via Command)', async () => {
        const textDocument = await workspace.openTextDocument(fileToFormatWithoutConfig);
        const originalContent = textDocument.getText();
        await window.showTextDocument(textDocument);
        await commands.executeCommand(Commands.Sort_Imports);
        assert.notEqual(originalContent, textDocument.getText(), 'Contents have not changed');
    });

    test('With Config', async () => {
        const textDocument = await workspace.openTextDocument(fileToFormatWithConfig);
        await window.showTextDocument(textDocument);
        const edit = (await sorter.provideDocumentSortImportsEdits(textDocument.uri))!;
        expect(edit).not.to.eq(undefined, 'No edit returned');
        expect(edit.entries()).to.be.lengthOf(1);
        const edits = edit.entries()[0][1];
        const newValue = `from third_party import lib2${EOL}from third_party import lib3${EOL}from third_party import lib4${EOL}from third_party import lib5${EOL}from third_party import lib6${EOL}from third_party import lib7${EOL}from third_party import lib8${EOL}from third_party import lib9${EOL}`;
        assert.equal(
            edits.filter((value) => value.newText === newValue && value.range.isEqual(new Range(0, 0, 3, 0))).length,
            1,
            'New Text not found',
        );
    });

    test('With Config (via Command)', async () => {
        const textDocument = await workspace.openTextDocument(fileToFormatWithConfig);
        const originalContent = textDocument.getText();
        await window.showTextDocument(textDocument);
        await commands.executeCommand(Commands.Sort_Imports);
        assert.notEqual(originalContent, textDocument.getText(), 'Contents have not changed');
    });

    test('With Changes and Config in Args', async () => {
        await updateSetting(
            'sortImports.args',
            ['--sp', path.join(sortingPath, 'withconfig')],
            Uri.file(sortingPath),
            ConfigurationTarget.Workspace,
        );
        const textDocument = await workspace.openTextDocument(fileToFormatWithConfig);
        const editor = await window.showTextDocument(textDocument);
        await editor.edit((builder) => {
            builder.insert(new Position(0, 0), `from third_party import lib0${EOL}`);
        });
        const edit = (await sorter.provideDocumentSortImportsEdits(textDocument.uri))!;
        expect(edit.entries()).to.be.lengthOf(1);
        const edits = edit.entries()[0][1];
        assert.notEqual(edits.length, 0, 'No edits');
    });
    test('With Changes and Config in Args (via Command)', async () => {
        await updateSetting(
            'sortImports.args',
            ['--sp', path.join(sortingPath, 'withconfig')],
            Uri.file(sortingPath),
            configTarget,
        );
        const textDocument = await workspace.openTextDocument(fileToFormatWithConfig);
        const editor = await window.showTextDocument(textDocument);
        await editor.edit((builder) => {
            builder.insert(new Position(0, 0), `from third_party import lib0${EOL}`);
        });
        const originalContent = textDocument.getText();
        await commands.executeCommand(Commands.Sort_Imports);
        assert.notEqual(originalContent, textDocument.getText(), 'Contents have not changed');
    }).timeout(TEST_TIMEOUT * 2);

    test('With Changes and Config implicit from cwd', async () => {
        const textDocument = await workspace.openTextDocument(fileToFormatWithConfig);
        assert.equal(textDocument.isDirty, false, 'Document should initially be unmodified');
        const editor = await window.showTextDocument(textDocument);
        await editor.edit((builder) => {
            builder.insert(new Position(0, 0), `from third_party import lib0${EOL}`);
        });
        assert.equal(textDocument.isDirty, true, 'Document should have been modified (pre sort)');
        await sorter.sortImports(textDocument.uri);
        assert.equal(textDocument.isDirty, true, 'Document should have been modified by sorting');
        const newValue = `from third_party import lib0${EOL}from third_party import lib1${EOL}from third_party import lib2${EOL}from third_party import lib3${EOL}from third_party import lib4${EOL}from third_party import lib5${EOL}from third_party import lib6${EOL}from third_party import lib7${EOL}from third_party import lib8${EOL}from third_party import lib9${EOL}`;
        assert.equal(textDocument.getText(), newValue);
    });
});
