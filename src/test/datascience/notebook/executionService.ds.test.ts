// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
// tslint:disable-next-line:no-require-imports no-var-requires
import cloneDeep = require('lodash/cloneDeep');
import { Subject } from 'rxjs';
import { anything, instance, mock, when } from 'ts-mockito';
import { CancellationTokenSource, NotebookCellRunState } from 'vscode';
import { IApplicationEnvironment, ICommandManager } from '../../../client/common/application/types';
import { IConfigurationService, IDisposable } from '../../../client/common/types';
import { createDeferredFromPromise, sleep } from '../../../client/common/utils/async';
import { NotebookEditor } from '../../../client/datascience/notebook/notebookEditor';
import { INotebookExecutionService } from '../../../client/datascience/notebook/types';
import { ICell, INotebook, INotebookEditorProvider, INotebookProvider } from '../../../client/datascience/types';
import { FakeClock, IExtensionTestApi } from '../../common';
import { closeActiveWindows, initialize, initializeTest } from '../../initialize';

// tslint:disable: no-any no-invalid-this
suite('DataScience - VSCode Notebook - Execution', function () {
    this.timeout(15_000);

    let api: IExtensionTestApi;
    let editorProvider: INotebookEditorProvider;
    const disposables: IDisposable[] = [];
    let oldValueFor_disableJupyterAutoStart: undefined | boolean = false;
    let executionService: INotebookExecutionService;
    let notebook: INotebook;
    let commandManager: ICommandManager;
    let originalGetOrCreateNotebook: INotebookProvider['getOrCreateNotebook'];
    let originalExecuteCellObservable: INotebookExecutionService['executeCell'];
    let fakeTimer: FakeClock;
    suiteSetup(async function () {
        api = await initialize();
        notebook = mock<INotebook>();
        const appEnv = api.serviceContainer.get<IApplicationEnvironment>(IApplicationEnvironment);
        if (appEnv.extensionChannel === 'stable') {
            return this.skip();
        }
        const notebookProvider = api.serviceContainer.get<INotebookProvider>(INotebookProvider);
        originalGetOrCreateNotebook = notebookProvider.getOrCreateNotebook;
        (instance(notebook) as any).then = undefined;
        notebookProvider.getOrCreateNotebook = () => Promise.resolve(instance(notebook));
        when(notebook.interruptKernel(anything())).thenResolve();
        when(notebook.restartKernel(anything())).thenResolve();

        const configSettings = api.serviceContainer.get<IConfigurationService>(IConfigurationService);
        oldValueFor_disableJupyterAutoStart = configSettings.getSettings(undefined).datascience.disableJupyterAutoStart;
    });
    setup(async () => {
        await initializeTest();
        fakeTimer = new FakeClock();
        // Reset for tests, do this everytime, as things can change due to config changes etc.
        const configSettings = api.serviceContainer.get<IConfigurationService>(IConfigurationService);
        configSettings.getSettings(undefined).datascience.disableJupyterAutoStart = true;
        editorProvider = api.serviceContainer.get<INotebookEditorProvider>(INotebookEditorProvider);
        executionService = api.serviceContainer.get<INotebookExecutionService>(INotebookExecutionService);
        commandManager = api.serviceContainer.get<ICommandManager>(ICommandManager);
        originalExecuteCellObservable = executionService.executeCell;
    });
    teardown(async () => {
        fakeTimer.uninstall();
        executionService.executeCell = originalExecuteCellObservable;
        while (disposables.length) {
            disposables.pop()?.dispose(); // NOSONAR;
        }
        await closeActiveWindows();
    });
    suiteTeardown(async () => {
        const notebookProvider = api.serviceContainer.get<INotebookProvider>(INotebookProvider);
        notebookProvider.getOrCreateNotebook = originalGetOrCreateNotebook;
        // Restore.
        const configSettings = api.serviceContainer.get<IConfigurationService>(IConfigurationService);
        configSettings.getSettings(undefined).datascience.disableJupyterAutoStart = oldValueFor_disableJupyterAutoStart;
        await closeActiveWindows();
    });

    test('Selecting VSCode Command will run cellxxx', async () => {
        // Open the notebook
        const editor = ((await editorProvider.createNew()) as unknown) as NotebookEditor;
        assert.isOk(editor);
        assert.instanceOf(editor, NotebookEditor);

        let cellExecuted = false;
        executionService.executeCell = async () => {
            cellExecuted = true;
        };

        fakeTimer.install();
        await commandManager.executeCommand('notebook.cell.execute');
        await fakeTimer.wait();

        assert.isTrue(cellExecuted);
    });
    test('Executing cell in Editor will cell', async () => {
        // Open the notebook
        const editor = ((await editorProvider.createNew()) as unknown) as NotebookEditor;
        assert.isOk(editor);
        assert.instanceOf(editor, NotebookEditor);

        let cellExecuted = false;
        executionService.executeCell = async () => {
            cellExecuted = true;
        };

        editor.runSelectedCell();

        await sleep(10); // Wait for VSCode command to get executed.
        assert.isTrue(cellExecuted);
    });
    test('Cancelling token will cancel cell executionxxx', async () => {
        // Open the notebook
        const editor = ((await editorProvider.createNew()) as unknown) as NotebookEditor;
        assert.isOk(editor);
        assert.instanceOf(editor, NotebookEditor);

        // Run a cell (with a mock notebook).
        const subject = new Subject<ICell[]>();
        when(notebook.executeObservable(anything(), anything(), anything(), anything(), anything())).thenReturn(
            subject
        );

        const cancellation = new CancellationTokenSource();
        const cell = editor.document.cells[0];
        const promise = executionService.executeCell(editor.document, cell, cancellation.token);
        const deferred = createDeferredFromPromise(promise);

        // Wait for 5s, and verify cell is still running.
        await sleep(5_000);
        assert.isFalse(deferred.completed);
        assert.equal(cell.metadata.runState, NotebookCellRunState.Running);

        // Interrupt the kernel.
        fakeTimer.install();
        cancellation.cancel();
        await fakeTimer.wait();

        assert.isTrue(deferred.completed);
        assert.equal(cell.metadata.runState, NotebookCellRunState.Idle);
    });
    test('Interrupting kernel will cancel cell execution', async () => {
        // Open the notebook
        const editor = ((await editorProvider.createNew()) as unknown) as NotebookEditor;
        assert.isOk(editor);
        assert.instanceOf(editor, NotebookEditor);

        // Run a cell (with a mock notebook).
        const subject = new Subject<ICell[]>();
        when(notebook.executeObservable(anything(), anything(), anything(), anything(), anything())).thenReturn(
            subject
        );

        const cell = editor.document.cells[0];
        const promise = executionService.executeCell(editor.document, cell, new CancellationTokenSource().token);
        const deferred = createDeferredFromPromise(promise);

        // Wait for 5s, and verify cell is still running.
        await sleep(5_000);
        assert.isFalse(deferred.completed);
        assert.equal(cell.metadata.runState, NotebookCellRunState.Running);

        // Interrupt the kernel.
        await editor.interruptKernel();
        assert.isTrue(deferred.completed);
        assert.equal(cell.metadata.runState, NotebookCellRunState.Idle);
    });
    test('Restarting kernel will cancel cell execution', async () => {
        // Open the notebook
        const editor = ((await editorProvider.createNew()) as unknown) as NotebookEditor;
        assert.isOk(editor);
        assert.instanceOf(editor, NotebookEditor);

        // Run a cell (with a mock notebook).
        const subject = new Subject<ICell[]>();
        when(notebook.executeObservable(anything(), anything(), anything(), anything(), anything())).thenReturn(
            subject
        );

        const cell = editor.document.cells[0];
        const promise = executionService.executeCell(editor.document, cell, new CancellationTokenSource().token);
        const deferred = createDeferredFromPromise(promise);

        // Wait for 5s, and verify cell is still running.
        await sleep(5_000);
        assert.isFalse(deferred.completed);
        assert.equal(cell.metadata.runState, NotebookCellRunState.Running);

        await editor.restartKernel();
        assert.isTrue(deferred.completed);
        assert.equal(cell.metadata.runState, NotebookCellRunState.Idle);
    });
    test('Interrupting kernel will cancel all pending cells', async () => {
        // Open the notebook
        const editor = ((await editorProvider.createNew()) as unknown) as NotebookEditor;
        assert.isOk(editor);
        assert.instanceOf(editor, NotebookEditor);

        // Run a cell (with a mock notebook).
        const subject = new Subject<ICell[]>();
        when(notebook.executeObservable(anything(), anything(), anything(), anything(), anything())).thenReturn(
            subject
        );

        const cell1 = editor.document.cells[0];
        const cell2 = cloneDeep(editor.document.cells[0]);
        const promise1 = executionService.executeCell(editor.document, cell1, new CancellationTokenSource().token);
        const promise2 = executionService.executeCell(editor.document, cell2, new CancellationTokenSource().token);
        const deferred1 = createDeferredFromPromise(promise1);
        const deferred2 = createDeferredFromPromise(promise2);

        // Wait for 5s, and verify cell is still running.
        await sleep(5_000);
        assert.isFalse(deferred1.completed);
        assert.isFalse(deferred2.completed);
        assert.equal(cell1.metadata.runState, NotebookCellRunState.Running);
        assert.equal(cell2.metadata.runState, NotebookCellRunState.Running);

        // Interrupt the kernel.
        await editor.interruptKernel();
        assert.isTrue(deferred1.completed);
        assert.isTrue(deferred2.completed);
        assert.equal(cell1.metadata.runState, NotebookCellRunState.Idle);
        assert.equal(cell2.metadata.runState, NotebookCellRunState.Idle);
    });
    test('Interrupting kernel will cancel cell execution in notebook', async () => {
        // Open the notebook
        const editor = ((await editorProvider.createNew()) as unknown) as NotebookEditor;
        assert.isOk(editor);
        assert.instanceOf(editor, NotebookEditor);

        // Run a cell (with a mock notebook).
        const subject = new Subject<ICell[]>();
        when(notebook.executeObservable(anything(), anything(), anything(), anything(), anything())).thenReturn(
            subject
        );

        const cell = editor.document.cells[0];
        const promise = executionService.executeAllCells(editor.document, new CancellationTokenSource().token);
        const deferred = createDeferredFromPromise(promise);

        // Wait for 5s, and verify cell is still running.
        await sleep(5_000);
        assert.isFalse(deferred.completed);
        assert.equal(cell.metadata.runState, NotebookCellRunState.Running);

        // Interrupt the kernel.
        await editor.interruptKernel();
        await sleep(1); // Wait for event loop to catch up.
        assert.isTrue(deferred.completed);
        assert.equal(cell.metadata.runState, NotebookCellRunState.Idle);
    });
});
