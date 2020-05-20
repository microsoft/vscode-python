// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import * as path from 'path';
import { Uri } from 'vscode';
import { IApplicationEnvironment, ICommandManager, IVSCodeNotebook } from '../../../client/common/application/types';
import { IConfigurationService, IDisposable } from '../../../client/common/types';
import { INotebookEditorProvider } from '../../../client/datascience/types';
import { IExtensionTestApi } from '../../common';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../constants';
import { closeActiveWindows, initialize, initializeTest } from '../../initialize';

suite('DataScience - VSCode Notebook', function () {
    // tslint:disable-next-line: no-invalid-this
    this.timeout(5_000);

    let api: IExtensionTestApi;
    let vscodeNotebook: IVSCodeNotebook;
    let editorProvider: INotebookEditorProvider;
    let commandManager: ICommandManager;
    const testIPynb = Uri.file(path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'test', 'datascience', 'test.ipynb'));
    const disposables: IDisposable[] = [];
    let oldValueFor_disableJupyterAutoStart: undefined | boolean = false;
    suiteSetup(async function () {
        api = await initialize();
        const appEnv = api.serviceContainer.get<IApplicationEnvironment>(IApplicationEnvironment);
        if (appEnv.extensionChannel === 'stable') {
            // tslint:disable-next-line: no-invalid-this
            return this.skip();
        }
        const configSettings = api.serviceContainer.get<IConfigurationService>(IConfigurationService);
        oldValueFor_disableJupyterAutoStart = configSettings.getSettings(undefined).datascience.disableJupyterAutoStart;
    });
    setup(async () => {
        await initializeTest();
        // Reset for tests, do this everytime, as things can change due to config changes etc.
        const configSettings = api.serviceContainer.get<IConfigurationService>(IConfigurationService);
        configSettings.getSettings(undefined).datascience.disableJupyterAutoStart = true;
        vscodeNotebook = api.serviceContainer.get<IVSCodeNotebook>(IVSCodeNotebook);
        editorProvider = api.serviceContainer.get<INotebookEditorProvider>(INotebookEditorProvider);
        commandManager = api.serviceContainer.get<ICommandManager>(ICommandManager);
    });
    teardown(async () => {
        while (disposables.length) {
            disposables.pop()?.dispose(); // NOSONAR;
        }
        await closeActiveWindows();
    });
    suiteTeardown(async () => {
        // Restore.
        const configSettings = api.serviceContainer.get<IConfigurationService>(IConfigurationService);
        configSettings.getSettings(undefined).datascience.disableJupyterAutoStart = oldValueFor_disableJupyterAutoStart;
        await closeActiveWindows();
    });

    test('Create empty notebook', async () => {
        const editor = await editorProvider.createNew();

        assert.isOk(editor);
    });
    test('Create empty notebook and we have active editor', async () => {
        assert.isUndefined(editorProvider.activeEditor);
        assert.equal(editorProvider.editors.length, 0);

        const editor = await editorProvider.createNew();

        assert.equal(editorProvider.editors.length, 1);
        assert.isOk(editor);
        assert.isOk(vscodeNotebook.activeNotebookEditor);
        assert.isOk(editorProvider.activeEditor);
        assert.equal(
            vscodeNotebook.activeNotebookEditor?.document.uri.fsPath.toLowerCase(),
            editor.file.fsPath.toLowerCase()
        );
        assert.equal(editorProvider.activeEditor?.file.fsPath.toLowerCase(), editor.file.fsPath.toLowerCase());
    });

    test('Create empty notebook will fire necessary events', async () => {
        let notebookOpened = false;
        let activeNotebookChanged = false;
        editorProvider.onDidChangeActiveNotebookEditor(() => (activeNotebookChanged = true), undefined, disposables);
        editorProvider.onDidOpenNotebookEditor(() => (notebookOpened = true), undefined, disposables);

        await editorProvider.createNew();

        assert.isTrue(notebookOpened);
        assert.isTrue(activeNotebookChanged);
    });
    test('Closing a notebook will fire necessary events and clear state', async () => {
        let notebookClosed = false;
        editorProvider.onDidCloseNotebookEditor(() => (notebookClosed = true), undefined, disposables);

        await editorProvider.createNew();
        await closeActiveWindows();

        assert.isUndefined(editorProvider.activeEditor);
        assert.equal(editorProvider.editors.length, 0);
        assert.isTrue(notebookClosed);
    });
    test('Open a notebook using our API', async () => {
        const editor = await editorProvider.open(testIPynb);

        assert.isOk(editor);
    });
    test('Open a notebook using our API and we will have an active editor', async () => {
        assert.isUndefined(editorProvider.activeEditor);
        assert.equal(editorProvider.editors.length, 0);

        const editor = await editorProvider.open(testIPynb);

        assert.equal(editorProvider.editors.length, 1);
        assert.isOk(editor);
        assert.isOk(vscodeNotebook.activeNotebookEditor);
        assert.isOk(editorProvider.activeEditor);
        assert.equal(
            vscodeNotebook.activeNotebookEditor?.document.uri.fsPath.toLowerCase(),
            editor.file.fsPath.toLowerCase()
        );
        assert.equal(editorProvider.activeEditor?.file.fsPath.toLowerCase(), editor.file.fsPath.toLowerCase());
    });
    test('Open a notebook using our API will fire necessary events', async () => {
        let notebookOpened = false;
        let activeNotebookChanged = false;
        editorProvider.onDidChangeActiveNotebookEditor(() => (activeNotebookChanged = true), undefined, disposables);
        editorProvider.onDidOpenNotebookEditor(() => (notebookOpened = true), undefined, disposables);

        await editorProvider.open(testIPynb);

        assert.isTrue(notebookOpened);
        assert.isTrue(activeNotebookChanged);
    });
    test('Open a notebook using VS Code API', async () => {
        assert.isUndefined(editorProvider.activeEditor);
        assert.equal(editorProvider.editors.length, 0);

        await commandManager.executeCommand('vscode.open', testIPynb);

        assert.equal(editorProvider.editors.length, 1);
        assert.isOk(vscodeNotebook.activeNotebookEditor);
        assert.isOk(editorProvider.activeEditor);
        assert.equal(editorProvider.activeEditor?.file.fsPath.toLowerCase(), testIPynb.fsPath.toLowerCase());
    });
    test('Open a notebook using VSC API then ours yields the same editor', async () => {
        assert.isUndefined(editorProvider.activeEditor);
        assert.equal(editorProvider.editors.length, 0);

        await commandManager.executeCommand('vscode.open', testIPynb);

        assert.equal(editorProvider.editors.length, 1);
        assert.isOk(vscodeNotebook.activeNotebookEditor);
        assert.equal(
            vscodeNotebook.activeNotebookEditor?.document.uri.fsPath.toLowerCase(),
            testIPynb.fsPath.toLowerCase()
        );
        assert.equal(editorProvider.activeEditor?.file.fsPath.toLowerCase(), testIPynb.fsPath.toLowerCase());

        // Opening again with our will do nothing (it will return the existing editor).
        const editor = await editorProvider.open(testIPynb);

        assert.equal(editorProvider.editors.length, 1);
        assert.equal(editor.file.fsPath.toLowerCase(), testIPynb.fsPath.toLowerCase());
    });
    test('Active notebook points to the currently active editor', async () => {
        const editor1 = await editorProvider.createNew();

        assert.isOk(vscodeNotebook.activeNotebookEditor);
        assert.equal(
            vscodeNotebook.activeNotebookEditor?.document.uri.fsPath.toLowerCase(),
            editor1.file.fsPath.toLowerCase()
        );
        assert.equal(
            vscodeNotebook.activeNotebookEditor?.document.uri.fsPath.toLowerCase(),
            editorProvider.activeEditor?.file.fsPath.toLowerCase()
        );

        const editor2 = await editorProvider.createNew();
        assert.equal(editorProvider.activeEditor?.file.fsPath.toLowerCase(), editor2.file.fsPath.toLowerCase());
    });
    test('Create two blank notebooks', async () => {
        const editor1 = await editorProvider.createNew();

        assert.equal(editor1.file.scheme, 'untitled');
        assert.equal(
            vscodeNotebook.activeNotebookEditor?.document.uri.fsPath.toLowerCase(),
            editor1.file.fsPath.toLowerCase()
        );

        const editor2 = await editorProvider.createNew();

        assert.equal(editor2.file.scheme, 'untitled');
        assert.equal(
            vscodeNotebook.activeNotebookEditor?.document.uri.fsPath.toLowerCase(),
            editor2.file.fsPath.toLowerCase()
        );
        assert.notEqual(
            vscodeNotebook.activeNotebookEditor?.document.uri.fsPath.toLowerCase(),
            editor1.file.fsPath.toLowerCase()
        );
    });
    test('Active Notebook Editor event gets fired when opening multiple notebooks', async () => {
        let notebookOpened = false;
        let activeNotebookChanged = false;
        editorProvider.onDidChangeActiveNotebookEditor(() => (activeNotebookChanged = true), undefined, disposables);
        editorProvider.onDidOpenNotebookEditor(() => (notebookOpened = true), undefined, disposables);

        await editorProvider.open(testIPynb);

        assert.isTrue(notebookOpened);
        assert.isTrue(activeNotebookChanged);

        // Clear and open another notebook.
        notebookOpened = false;
        activeNotebookChanged = false;
        await commandManager.executeCommand('vscode.open', testIPynb);

        assert.isTrue(notebookOpened);
        assert.isTrue(activeNotebookChanged);
    });
});
