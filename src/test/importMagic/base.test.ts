import * as assert from 'assert';
import * as path from 'path';
import { closeActiveWindows, initialize, initializeTest } from '../initialize';
import { UnitTestIocContainer } from '../unittests/serviceRegistry';
import * as vscode from 'vscode';
import { Uri, workspace, window, commands, WorkspaceConfiguration } from 'vscode';
import { ImportMagicProxyFactory } from './../../client/languageServices/importMagicProxyFactory';
import { ImportMagicProvider } from './../../client/providers/importMagicProvider';

const importMagicPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'importMagic');
const extensionRootDir = path.join(__dirname, '..', '..', '..');

const fileOne = path.join(importMagicPath, 'one.py');
const fileCompl = path.join(importMagicPath, 'compl.py');

// tslint:disable-next-line:max-func-body-length
suite('ImportMagic', () => {
    let ioc: UnitTestIocContainer;
    let im: ImportMagicProvider;
    let importMagicProxyFactory: ImportMagicProxyFactory;
    let settings: WorkspaceConfiguration;
    let oldExtraPaths: string[] | undefined;

    suiteSetup(async () => {
        await initialize();
        initializeDI();

        importMagicProxyFactory = new ImportMagicProxyFactory(extensionRootDir, ioc.serviceContainer);

        settings = workspace.getConfiguration('python', Uri.file(importMagicPath));
        oldExtraPaths = settings.get('autoComplete.extraPaths');
        await settings.update('autoComplete.extraPaths', [importMagicPath]);
    });
    setup(async () => {
        await initializeTest();
        initializeDI();

        im = new ImportMagicProvider(importMagicProxyFactory, true);
    });

    suiteTeardown(async () => {
        closeActiveWindows();
        importMagicProxyFactory.dispose();
        await settings.update('autoComplete.extraPaths', oldExtraPaths);
    });

    teardown(async () => {
        await closeActiveWindows();
        ioc.dispose();
        im.dispose();
    });

    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerVariableTypes();
        ioc.registerProcessTypes();
    }

    test('Import candidates from project folder', async () => {
        const textDocument = await workspace.openTextDocument(fileOne);
        await window.showTextDocument(textDocument);
        const suggestions = await im.getImportSuggestions(fileOne, 'FirstClass');
        assert.equal(suggestions.length > 0, true);
        assert.equal(suggestions[0].variable, 'FirstClass');
        assert.equal(suggestions[0].label, 'from classes import FirstClass');
    });

    test('Import candidates from system module', async () => {
        const textDocument = await workspace.openTextDocument(fileOne);
        await window.showTextDocument(textDocument);
        const suggestions = await im.getImportSuggestions(fileOne, 'sys');
        assert.equal(suggestions.length > 0, true);
        assert.equal(suggestions[0].variable, undefined);
        assert.equal(suggestions[0].module, 'sys');
        assert.equal(suggestions[0].label, 'import sys');
    });

    test('Import candidates from system modules', async () => {
        const textDocument = await workspace.openTextDocument(fileOne);
        await window.showTextDocument(textDocument);
        const suggestions = await im.getImportSuggestions(fileOne, 'path');
        assert.equal(suggestions.length > 0, true);
        assert.equal(suggestions.filter(value => value.label === 'from os import path').length, 1);
        assert.equal(suggestions.filter(value => value.label === 'from sys import path').length, 1);
    });

    test('Insert import', async () => {
        const textDocument = await workspace.openTextDocument(fileOne);
        const originalContent = textDocument.getText();

        await window.showTextDocument(textDocument);
        const suggestions = await im.getImportSuggestions(fileOne, 'FirstClass');
        const selection = suggestions[0];
        await commands.executeCommand('importMagic.insertImport', selection.module, selection.variable);
        assert.notEqual(originalContent, textDocument.getText(), 'Contents have not changed');
    });

    test('Completion provider get symbols', async () => {
        const textDocument = await workspace.openTextDocument(fileCompl);

        await window.showTextDocument(textDocument);
        const position = new vscode.Position(0, 34);

        await commands.executeCommand('importMagic.findSymbols');
        const list = await commands.executeCommand<vscode.CompletionList>('vscode.executeCompletionItemProvider', textDocument.uri, position);

        assert.equal(list!.items.length > 0, true);
        assert.equal(list!.items.filter(item => item.label === 'AnotherClass2' && item.detail === 'from classes2').length, 1);
    });
});
