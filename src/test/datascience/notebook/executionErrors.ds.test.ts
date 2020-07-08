// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import { Subject } from 'rxjs';
import * as sinon from 'sinon';
import { anything, instance, mock, when } from 'ts-mockito';
import { commands } from 'vscode';
import {
    ICell,
    IDataScienceErrorHandler,
    INotebook,
    INotebookEditorProvider,
    INotebookProvider
} from '../../../client/datascience/types';
import { IExtensionTestApi } from '../../common';
import { initialize, initializeTest } from '../../initialize';
import { canRunTests, closeNotebooksAndCleanUpAfterTests, insertPythonCellAndWait } from './helper';

// tslint:disable: no-any no-invalid-this
suite('DataScience - VSCode Notebook - Errors in Execution', function () {
    this.timeout(15_000);

    let api: IExtensionTestApi;
    let editorProvider: INotebookEditorProvider;
    let handleErrorStub: sinon.SinonStub<[Error], Promise<void>>;
    let errorHandler: IDataScienceErrorHandler;
    let notebook: INotebook;
    suiteSetup(async function () {
        this.timeout(15_000);
        api = await initialize();
        if (!(await canRunTests())) {
            return this.skip();
        }
    });
    setup(async () => {
        sinon.restore();
        await initializeTest();
        const notebookProvider = api.serviceContainer.get<INotebookProvider>(INotebookProvider);
        notebook = mock<INotebook>();
        (instance(notebook) as any).then = undefined;
        sinon.stub(notebookProvider, 'getOrCreateNotebook').resolves(instance(notebook));

        editorProvider = api.serviceContainer.get<INotebookEditorProvider>(INotebookEditorProvider);
        errorHandler = api.serviceContainer.get<IDataScienceErrorHandler>(IDataScienceErrorHandler);
        handleErrorStub = sinon.stub(errorHandler, 'handleError');
        handleErrorStub.resolves();
    });
    teardown(closeNotebooksAndCleanUpAfterTests);
    suiteTeardown(closeNotebooksAndCleanUpAfterTests);

    test('Errors thrown while starting a cell execution are handled by error handler', async () => {
        // Open the notebook
        await editorProvider.createNew();
        await insertPythonCellAndWait('#');

        // Run a cell (with a mock notebook).
        const error = new Error('MyError');
        when(notebook.executeObservable(anything(), anything(), anything(), anything(), anything())).thenThrow(error);
        await commands.executeCommand('notebook.execute');

        assert.isTrue(handleErrorStub.calledOnce);
        assert.isTrue(handleErrorStub.calledOnceWithExactly(error));
    });
    test('Errors thrown in cell execution (jupyter results) are handled by error handler', async () => {
        // Open the notebook
        await editorProvider.createNew();
        await insertPythonCellAndWait('#');

        // Run a cell (with a mock notebook).
        const error = new Error('MyError');
        const subject = new Subject<ICell[]>();
        subject.error(error);
        when(notebook.executeObservable(anything(), anything(), anything(), anything(), anything())).thenReturn(
            subject
        );

        // Execute cells (it should throw an error).
        await commands.executeCommand('notebook.execute');

        assert.isTrue(handleErrorStub.calledOnce);
        assert.isTrue(handleErrorStub.calledOnceWithExactly(error));
    });
});
