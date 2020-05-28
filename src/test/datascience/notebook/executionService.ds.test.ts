// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
// tslint:disable-next-line:no-require-imports no-var-requires
import cloneDeep = require('lodash/cloneDeep');
import { Subject } from 'rxjs';
import * as sinon from 'sinon';
import { anything, instance, mock, when } from 'ts-mockito';
import { CancellationToken, CancellationTokenSource } from 'vscode';
import type { NotebookCell, NotebookDocument } from 'vscode-proposed';
// tslint:disable-next-line: no-var-requires no-require-imports
const vscodeNotebookEnums = require('vscode') as typeof import('vscode-proposed');
import { IApplicationEnvironment, ICommandManager } from '../../../client/common/application/types';
import { IConfigurationService, IDisposable } from '../../../client/common/types';
import { createDeferredFromPromise, sleep } from '../../../client/common/utils/async';
import { NotebookEditor } from '../../../client/datascience/notebook/notebookEditor';
import { INotebookExecutionService } from '../../../client/datascience/notebook/types';
import {
    GetNotebookOptions,
    ICell,
    IDataScienceErrorHandler,
    INotebook,
    INotebookEditorProvider,
    INotebookProvider
} from '../../../client/datascience/types';
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
    let getOrCreateNotebookStub: sinon.SinonStub<[GetNotebookOptions], Promise<INotebook | undefined>>;
    let handleErrorStub: sinon.SinonStub<[Error], Promise<void>>;
    let fakeTimer: FakeClock;
    let errorHandler: IDataScienceErrorHandler;
    let executeCellStub: sinon.SinonStub<[NotebookDocument, NotebookCell, CancellationToken], Promise<void>>;
    suiteSetup(async function () {
        api = await initialize();
        notebook = mock<INotebook>();
        const appEnv = api.serviceContainer.get<IApplicationEnvironment>(IApplicationEnvironment);
        if (appEnv.extensionChannel === 'stable') {
            return this.skip();
        }
        // Reset for tests, do this everytime, as things can change due to config changes etc.
        const configSettings = api.serviceContainer.get<IConfigurationService>(IConfigurationService);
        oldValueFor_disableJupyterAutoStart = configSettings.getSettings(undefined).datascience.disableJupyterAutoStart;
        configSettings.getSettings(undefined).datascience.disableJupyterAutoStart = true;
    });
    setup(async () => {
        sinon.restore();
        await initializeTest();
        const notebookProvider = api.serviceContainer.get<INotebookProvider>(INotebookProvider);
        getOrCreateNotebookStub = sinon.stub(notebookProvider, 'getOrCreateNotebook');
        getOrCreateNotebookStub.resolves(instance(notebook));
        (instance(notebook) as any).then = undefined;
        notebookProvider.getOrCreateNotebook = () => Promise.resolve(instance(notebook));
        when(notebook.interruptKernel(anything())).thenResolve();
        when(notebook.restartKernel(anything())).thenResolve();

        fakeTimer = new FakeClock();
        // Reset for tests, do this everytime, as things can change due to config changes etc.
        const configSettings = api.serviceContainer.get<IConfigurationService>(IConfigurationService);
        configSettings.getSettings(undefined).datascience.disableJupyterAutoStart = true;
        editorProvider = api.serviceContainer.get<INotebookEditorProvider>(INotebookEditorProvider);
        executionService = api.serviceContainer.get<INotebookExecutionService>(INotebookExecutionService);
        commandManager = api.serviceContainer.get<ICommandManager>(ICommandManager);
        errorHandler = api.serviceContainer.get<IDataScienceErrorHandler>(IDataScienceErrorHandler);
        handleErrorStub = sinon.stub(errorHandler, 'handleError');
        handleErrorStub.resolves();
    });
    teardown(async () => {
        sinon.restore();
        fakeTimer.uninstall();
        while (disposables.length) {
            disposables.pop()?.dispose(); // NOSONAR;
        }
        await closeActiveWindows();
    });
    suiteTeardown(async () => {
        sinon.restore();
        const configSettings = api.serviceContainer.get<IConfigurationService>(IConfigurationService);
        configSettings.getSettings(undefined).datascience.disableJupyterAutoStart = oldValueFor_disableJupyterAutoStart;
        await closeActiveWindows();
    });

    test('Selecting VSCode Command will run cell', async () => {
        // Open the notebook
        const editor = ((await editorProvider.createNew()) as unknown) as NotebookEditor;
        assert.isOk(editor);
        assert.instanceOf(editor, NotebookEditor);

        executeCellStub = sinon.stub(executionService, 'executeCell');
        executeCellStub.resolves();

        fakeTimer.install();
        await commandManager.executeCommand('notebook.cell.execute');
        await fakeTimer.wait();

        assert.isTrue(executeCellStub.calledOnce);
    });
    test('Executing cell in Editor will cell', async () => {
        // Open the notebook
        const editor = ((await editorProvider.createNew()) as unknown) as NotebookEditor;
        assert.isOk(editor);
        assert.instanceOf(editor, NotebookEditor);

        executeCellStub = sinon.stub(executionService, 'executeCell');
        executeCellStub.resolves();

        editor.runSelectedCell();

        await sleep(10); // Wait for VSCode command to get executed.
        assert.isTrue(executeCellStub.calledOnce);
    });
    test('Cancelling token will cancel cell execution', async () => {
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
        assert.equal(cell.metadata.runState, vscodeNotebookEnums.NotebookCellRunState.Running);

        // Interrupt the kernel.
        fakeTimer.install();
        cancellation.cancel();
        await fakeTimer.wait();

        assert.isTrue(deferred.completed);
        assert.equal(cell.metadata.runState, vscodeNotebookEnums.NotebookCellRunState.Idle);
    });
    test('Cancelling token will interrupt kernel', async () => {
        // Open the notebook
        const editor = ((await editorProvider.createNew()) as unknown) as NotebookEditor;
        assert.isOk(editor);
        assert.instanceOf(editor, NotebookEditor);
        const interruptKernelStub = sinon.stub(editor, 'interruptKernel');
        interruptKernelStub.resolves();
        disposables.push({ dispose: () => interruptKernelStub.restore() });

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
        assert.equal(cell.metadata.runState, vscodeNotebookEnums.NotebookCellRunState.Running);

        // Interrupt the kernel.
        fakeTimer.install();
        cancellation.cancel();
        await fakeTimer.wait();

        assert.isTrue(interruptKernelStub.calledOnce);
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
        assert.equal(cell.metadata.runState, vscodeNotebookEnums.NotebookCellRunState.Running);

        // Interrupt the kernel.
        await editor.interruptKernel();
        assert.isTrue(deferred.completed);
        assert.equal(cell.metadata.runState, vscodeNotebookEnums.NotebookCellRunState.Idle);
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
        assert.equal(cell.metadata.runState, vscodeNotebookEnums.NotebookCellRunState.Running);

        await editor.restartKernel();
        assert.isTrue(deferred.completed);
        assert.equal(cell.metadata.runState, vscodeNotebookEnums.NotebookCellRunState.Idle);
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
        assert.equal(cell1.metadata.runState, vscodeNotebookEnums.NotebookCellRunState.Running);
        assert.equal(cell2.metadata.runState, vscodeNotebookEnums.NotebookCellRunState.Running);

        // Interrupt the kernel.
        await editor.interruptKernel();
        assert.isTrue(deferred1.completed);
        assert.isTrue(deferred2.completed);
        assert.equal(cell1.metadata.runState, vscodeNotebookEnums.NotebookCellRunState.Idle);
        assert.equal(cell2.metadata.runState, vscodeNotebookEnums.NotebookCellRunState.Idle);
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
        assert.equal(cell.metadata.runState, vscodeNotebookEnums.NotebookCellRunState.Running);

        // Interrupt the kernel.
        fakeTimer.install();
        await editor.interruptKernel();
        await fakeTimer.wait();
        assert.isTrue(deferred.completed);
        assert.equal(cell.metadata.runState, vscodeNotebookEnums.NotebookCellRunState.Idle);
    });
    test('Errors thrown while starting a cell execution are handled by error handler', async () => {
        // Open the notebook
        const editor = ((await editorProvider.createNew()) as unknown) as NotebookEditor;
        assert.isOk(editor);
        assert.instanceOf(editor, NotebookEditor);

        // Run a cell (with a mock notebook).
        const error = new Error('MyError');
        when(notebook.executeObservable(anything(), anything(), anything(), anything(), anything())).thenThrow(error);

        const cell = editor.document.cells[0];
        await executionService.executeCell(editor.document, cell, new CancellationTokenSource().token);

        assert.isTrue(handleErrorStub.calledOnce);
        assert.isTrue(handleErrorStub.calledOnceWithExactly(error));
    });
    test('Errors thrown in cell execution (jupyter results) are handled by error handler', async () => {
        // Open the notebook
        const editor = ((await editorProvider.createNew()) as unknown) as NotebookEditor;
        assert.isOk(editor);
        assert.instanceOf(editor, NotebookEditor);

        // Run a cell (with a mock notebook).
        const error = new Error('MyError');
        const subject = new Subject<ICell[]>();
        subject.error(error);
        when(notebook.executeObservable(anything(), anything(), anything(), anything(), anything())).thenReturn(
            subject
        );

        const cell = editor.document.cells[0];
        await executionService.executeCell(editor.document, cell, new CancellationTokenSource().token);

        assert.isTrue(handleErrorStub.calledOnce);
        assert.isTrue(handleErrorStub.calledOnceWithExactly(error));
    });
});
