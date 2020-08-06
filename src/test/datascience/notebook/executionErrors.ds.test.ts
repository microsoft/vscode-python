// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import { Subject } from 'rxjs';
import * as sinon from 'sinon';
import { anything, instance, mock, when } from 'ts-mockito';
import { KernelProvider } from '../../../client/datascience/jupyter/kernels/kernelProvider';
import { IKernel } from '../../../client/datascience/jupyter/kernels/types';
import { ICell, IDataScienceErrorHandler, INotebookEditorProvider } from '../../../client/datascience/types';
import { IExtensionTestApi, waitForCondition } from '../../common';
import { initialize, initializeTest } from '../../initialize';
import {
    canRunTests,
    closeNotebooksAndCleanUpAfterTests,
    executeActiveDocument,
    insertPythonCellAndWait,
    trustAllNotebooks
} from './helper';

// tslint:disable: no-any no-invalid-this
suite('DataScience - VSCode Notebook - Errors in Execution', function () {
    this.timeout(60_000);

    let api: IExtensionTestApi;
    let editorProvider: INotebookEditorProvider;
    let handleErrorStub: sinon.SinonStub<[Error], Promise<void>>;
    let errorHandler: IDataScienceErrorHandler;
    let kernel: IKernel;
    let kernelProvider: KernelProvider;
    suiteSetup(async function () {
        this.timeout(60_000);
        api = await initialize();
        if (!(await canRunTests())) {
            return this.skip();
        }
    });
    setup(async () => {
        sinon.restore();
        await initializeTest();
        await trustAllNotebooks();
        kernelProvider = api.serviceContainer.get<KernelProvider>(KernelProvider);
        kernel = mock<IKernel>();
        (instance(kernel) as any).then = undefined;
        sinon.stub(kernelProvider, 'getOrCreate').returns(instance(kernel));

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
        await insertPythonCellAndWait('1234');
        // await sleep(10_000);
        // Run a cell (with a mock notebook).
        const error = new Error('MyError');
        when(kernel.executeObservable(anything(), anything(), anything(), anything(), anything())).thenThrow(error);
        // Execute cells (it should throw an error).
        await executeActiveDocument();

        await waitForCondition(async () => handleErrorStub.calledOnce, 60_000, 'handleError not called');
        assert.isTrue(handleErrorStub.calledOnceWithExactly(error));
    });
    test('Errors thrown in cell execution (jupyter results) are handled by error handler', async () => {
        // Open the notebook
        await editorProvider.createNew();
        await insertPythonCellAndWait('1234');

        // Run a cell (with a mock notebook).
        const error = new Error('MyError');
        const subject = new Subject<ICell[]>();
        subject.error(error);
        when(kernel.executeObservable(anything(), anything(), anything(), anything(), anything())).thenReturn(subject);

        // Execute cells (it should throw an error).
        await executeActiveDocument();

        await waitForCondition(async () => handleErrorStub.calledOnce, 60_000, 'handleError not called');
        assert.isTrue(handleErrorStub.calledOnceWithExactly(error));
    });
});
