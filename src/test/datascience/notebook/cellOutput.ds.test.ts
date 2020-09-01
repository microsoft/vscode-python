// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-require-imports no-var-requires
import { join } from 'path';
import { Subject } from 'rxjs/Subject';
import * as sinon from 'sinon';
import { anything, instance, mock, reset, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { IDisposable } from '../../../client/common/types';
import { ICell, INotebook, INotebookEditorProvider, INotebookProvider } from '../../../client/datascience/types';
import { IExtensionTestApi } from '../../common';
import { EXTENSION_ROOT_DIR_FOR_TESTS, initialize } from '../../initialize';
import {
    canRunTests,
    closeNotebooksAndCleanUpAfterTests,
    createTemporaryNotebook,
    deleteAllCellsAndWait,
    trustAllNotebooks
} from './helper';

// tslint:disable-next-line: no-var-requires no-require-imports

// tslint:disable: no-any no-invalid-this
suite('DataScience - VSCode Notebook - (fake execution) (Clearing Output)', function () {
    this.timeout(10_000);

    let api: IExtensionTestApi;
    let editorProvider: INotebookEditorProvider;
    let notebookProvider: INotebookProvider;
    let nb: INotebook;
    let cellObservableResult: Subject<ICell[]>;
    let cell2ObservableResult: Subject<ICell[]>;

    suiteSetup(async function () {
        api = await initialize();
        if (!(await canRunTests())) {
            return this.skip();
        }
        await trustAllNotebooks();
        notebookProvider = api.serviceContainer.get<INotebookProvider>(INotebookProvider);
        editorProvider = api.serviceContainer.get<INotebookEditorProvider>(INotebookEditorProvider);
    });
    suiteTeardown(() => closeNotebooksAndCleanUpAfterTests([]));
    suite('Different notebooks in each test', () => {
        const disposables2: IDisposable[] = [];
        const templateIPynb = join(
            EXTENSION_ROOT_DIR_FOR_TESTS,
            'src',
            'test',
            'datascience',
            'notebook',
            'with3CellsAndOutput.ipynb'
        );
        suiteTeardown(() => closeNotebooksAndCleanUpAfterTests(disposables2));
        setup(async () => {
            await trustAllNotebooks();
            const testIPynb = Uri.file(await createTemporaryNotebook(templateIPynb, disposables2));
            await editorProvider.open(testIPynb);
        });
    });
    suite('Use same notebook for tests', () => {
        suiteSetup(async () => {
            await trustAllNotebooks();
            // Open a notebook and use this for all tests in this test suite.
            await editorProvider.createNew();
        });
        setup(async () => {
            sinon.restore();
            const getOrCreateNotebook = sinon.stub(notebookProvider, 'getOrCreateNotebook');
            nb = mock<INotebook>();
            (instance(nb) as any).then = undefined;
            getOrCreateNotebook.resolves(instance(nb));

            cellObservableResult = new Subject<ICell[]>();
            cell2ObservableResult = new Subject<ICell[]>();
            reset(nb);
            when(nb.executeObservable(anything(), anything(), anything(), anything(), anything())).thenReturn(
                cellObservableResult.asObservable()
            );
            await deleteAllCellsAndWait();
        });
        teardown(() => {
            cellObservableResult.unsubscribe();
            cell2ObservableResult.unsubscribe();
        });
    });
});
