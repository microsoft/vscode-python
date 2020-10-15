// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-require-imports no-var-requires
import * as path from 'path';
import * as sinon from 'sinon';
import { Uri } from 'vscode';
import { IVSCodeNotebook } from '../../../client/common/application/types';
import { IDisposable } from '../../../client/common/types';
import { VSCodeNotebookProvider } from '../../../client/datascience/constants';
import { NotebookCellLanguageService } from '../../../client/datascience/notebook/defaultCellLanguageService';
import { INotebookEditorProvider } from '../../../client/datascience/types';
import { IExtensionTestApi, waitForCondition } from '../../common';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../constants';
import { initialize } from '../../initialize';
import { openNotebook } from '../helpers';
import {
    assertHasExecutionCompletedSuccessfully,
    assertHasTextOutputInVSCode,
    canRunTests,
    closeNotebooks,
    closeNotebooksAndCleanUpAfterTests,
    createTemporaryNotebook,
    executeActiveDocument,
    insertCodeCell,
    insertMarkdownCell,
    saveActiveNotebook,
    trustAllNotebooks,
    waitForKernelToGetAutoSelected
} from './helper';

// tslint:disable: no-any no-invalid-this
suite('DataScience - VSCode Notebook - Kernels (non-python-kernel) (slow)', () => {
    const juliaNb = path.join(
        EXTENSION_ROOT_DIR_FOR_TESTS,
        'src',
        'test',
        'datascience',
        'notebook',
        'simpleJulia.ipynb'
    );

    const emptyPythonNb = path.join(
        EXTENSION_ROOT_DIR_FOR_TESTS,
        'src',
        'test',
        'datascience',
        'notebook',
        'emptyPython.ipynb'
    );

    let api: IExtensionTestApi;
    const disposables: IDisposable[] = [];
    let vscodeNotebook: IVSCodeNotebook;
    let testJuliaNb: Uri;
    let testEmptyPythonNb: Uri;
    let editorProvider: INotebookEditorProvider;
    let languageService: NotebookCellLanguageService;
    suiteSetup(async function () {
        api = await initialize();
        if (!process.env.VSC_PYTHON_CI_NON_PYTHON_NB_TEST || !(await canRunTests())) {
            return this.skip();
        }
        await trustAllNotebooks();
        sinon.restore();
        vscodeNotebook = api.serviceContainer.get<IVSCodeNotebook>(IVSCodeNotebook);
        editorProvider = api.serviceContainer.get<INotebookEditorProvider>(VSCodeNotebookProvider);
        languageService = api.serviceContainer.get<NotebookCellLanguageService>(NotebookCellLanguageService);
    });
    setup(async () => {
        sinon.restore();
        await closeNotebooks();
        // Don't use same file (due to dirty handling, we might save in dirty.)
        // Cuz we won't save to file, hence extension will backup in dirty file and when u re-open it will open from dirty.
        testJuliaNb = Uri.file(await createTemporaryNotebook(juliaNb, disposables));
        testEmptyPythonNb = Uri.file(await createTemporaryNotebook(emptyPythonNb, disposables));
    });
    suiteTeardown(() => closeNotebooksAndCleanUpAfterTests(disposables));
    test('Automatically pick julia kernel when opening a Julia Notebook', async () => {
        await openNotebook(api.serviceContainer, juliaNb, true);
        await waitForKernelToGetAutoSelected('julia');
    });
    test('New notebook will have a Julia cell if last notebook was a julia nb', async () => {
        await openNotebook(api.serviceContainer, testJuliaNb.fsPath, false);
        await waitForKernelToGetAutoSelected();
        await insertMarkdownCell('# Hello');
        await saveActiveNotebook([]);

        // Add another cell, to ensure changes are detected by our code.
        await insertMarkdownCell('# Hello');
        await saveActiveNotebook([]);
        await closeNotebooks();

        // Wait for the default cell language to change.
        await waitForCondition(
            async () => languageService.getPreferredLanguage().toLowerCase() === 'julia',
            10_000,
            'Default cell language is not Julia'
        );
        // Create a blank notebook & confirm we have a julia code cell & julia kernel.
        await editorProvider.createNew();

        await waitForCondition(
            async () => vscodeNotebook.activeNotebookEditor?.document.cells[0].language.toLowerCase() === 'julia',
            5_000,
            'First cell is not julia'
        );
        await waitForKernelToGetAutoSelected('julia');

        // Lets try opening a python nb & validate that.
        await closeNotebooks();

        // Now open an existing python notebook & confirm kernel is set to Python.
        await openNotebook(api.serviceContainer, testEmptyPythonNb.fsPath, false);
        await waitForKernelToGetAutoSelected('python');
    });
    test('Can run a Julia notebook', async function () {
        this.timeout(30_000); // Can be slow to start Julia kernel on CI.
        await openNotebook(api.serviceContainer, testJuliaNb.fsPath, false);
        await insertCodeCell('123456', { language: 'julia', index: 0 });
        await waitForKernelToGetAutoSelected();
        await executeActiveDocument();

        const cell = vscodeNotebook.activeNotebookEditor?.document.cells![0]!;
        // Wait till execution count changes and status is success.
        await waitForCondition(
            async () => assertHasExecutionCompletedSuccessfully(cell),
            15_000,
            'Cell did not get executed'
        );

        assertHasTextOutputInVSCode(cell, '123456', 0, false);
    });
});
