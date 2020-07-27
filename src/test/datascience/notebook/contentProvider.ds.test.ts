// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-require-imports no-var-requires
import { nbformat } from '@jupyterlab/coreutils';
import { assert } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as sinon from 'sinon';
import { CellErrorOutput, Uri } from 'vscode';
import { CellDisplayOutput } from '../../../../types/vscode-proposed';
import { IVSCodeNotebook } from '../../../client/common/application/types';
import { IDisposable } from '../../../client/common/types';
import { INotebookEditorProvider } from '../../../client/datascience/types';
import { IExtensionTestApi } from '../../common';
import { EXTENSION_ROOT_DIR_FOR_TESTS, initialize } from '../../initialize';
import { canRunTests, closeNotebooksAndCleanUpAfterTests, createTemporaryNotebook, trustAllNotebooks } from './helper';
// tslint:disable-next-line: no-var-requires no-require-imports
const vscodeNotebookEnums = require('vscode') as typeof import('vscode-proposed');

// tslint:disable: no-any no-invalid-this
suite('DataScience - VSCode Notebook - (Open)', function () {
    this.timeout(15_000);
    const templateIPynb = path.join(
        EXTENSION_ROOT_DIR_FOR_TESTS,
        'src',
        'test',
        'datascience',
        'notebook',
        'withOutput.ipynb'
    );
    let api: IExtensionTestApi;
    let testIPynb: Uri;
    const disposables: IDisposable[] = [];
    suiteSetup(async function () {
        this.timeout(15_000);
        api = await initialize();
        if (!(await canRunTests())) {
            return this.skip();
        }
        await trustAllNotebooks();
    });
    setup(async () => {
        sinon.restore();
        // Don't use same file (due to dirty handling, we might save in dirty.)
        // Cuz we won't save to file, hence extension will backup in dirty file and when u re-open it will open from dirty.
        testIPynb = Uri.file(await createTemporaryNotebook(templateIPynb, disposables));
    });
    teardown(async () => closeNotebooksAndCleanUpAfterTests(disposables));

    test('Verify cells (content, metadata & output)', async () => {
        const vscodeNotebook = api.serviceContainer.get<IVSCodeNotebook>(IVSCodeNotebook);
        const editorProvider = api.serviceContainer.get<INotebookEditorProvider>(INotebookEditorProvider);
        const model = (await editorProvider.open(testIPynb))!.model!;
        model.trust(); // We want to test the output as well.

        const notebook = vscodeNotebook.activeNotebookEditor?.document!;

        assert.equal(notebook.cells.length, model?.cells.length, 'Incorrect number of cells');
        assert.equal(notebook.cells.length, 6, 'Incorrect number of cells');

        // Cell 1.
        assert.equal(notebook.cells[0].cellKind, vscodeNotebookEnums.CellKind.Code, 'Cell1, type');
        assert.lengthOf(notebook.cells[0].outputs, 0, 'Cell1, outputs');
        assert.include(notebook.cells[0].document.getText(), 'a=1', 'Cell1, source');
        assert.isUndefined(notebook.cells[0].metadata.executionOrder, 'Cell1, execution count');
        assert.lengthOf(Object.keys(notebook.cells[0].metadata.custom || {}), 1, 'Cell1, metadata');
        assert.containsAllKeys(notebook.cells[0].metadata.custom || {}, { metadata: '' }, 'Cell1, metadata');

        // Cell 2.
        assert.equal(notebook.cells[1].cellKind, vscodeNotebookEnums.CellKind.Code, 'Cell2, type');
        assert.include(notebook.cells[1].document.getText(), 'pip list', 'Cell1, source');
        assert.lengthOf(notebook.cells[1].outputs, 1, 'Cell2, outputs');
        assert.equal(notebook.cells[1].outputs[0].outputKind, vscodeNotebookEnums.CellOutputKind.Rich, 'Cell2, output');
        assert.equal(notebook.cells[1].metadata.executionOrder, 3, 'Cell2, execution count');
        assert.lengthOf(Object.keys(notebook.cells[1].metadata.custom || {}), 1, 'Cell2, metadata');
        assert.deepEqual(notebook.cells[1].metadata.custom?.metadata.tags, ['WOW'], 'Cell2, metadata');

        // Cell 3.
        assert.equal(notebook.cells[2].cellKind, vscodeNotebookEnums.CellKind.Markdown, 'Cell3, type');
        assert.include(notebook.cells[2].document.getText(), '# HELLO WORLD', 'Cell3, source');
        assert.lengthOf(notebook.cells[2].outputs, 0, 'Cell3, outputs');
        assert.isUndefined(notebook.cells[2].metadata.executionOrder, 'Cell3, execution count');
        assert.lengthOf(Object.keys(notebook.cells[2].metadata.custom || {}), 1, 'Cell3, metadata');
        assert.isEmpty(notebook.cells[2].metadata.custom?.metadata, 'Cell3, metadata');

        // Cell 4.
        assert.equal(notebook.cells[3].cellKind, vscodeNotebookEnums.CellKind.Code, 'Cell4, type');
        assert.include(notebook.cells[3].document.getText(), 'with Error', 'Cell4, source');
        assert.lengthOf(notebook.cells[3].outputs, 1, 'Cell4, outputs');
        assert.equal(
            notebook.cells[3].outputs[0].outputKind,
            vscodeNotebookEnums.CellOutputKind.Error,
            'Cell4, output'
        );
        const errorOutput = (notebook.cells[3].outputs[0] as unknown) as CellErrorOutput;
        assert.equal(errorOutput.ename, 'SyntaxError', 'Cell4, output');
        assert.equal(errorOutput.evalue, 'invalid syntax (<ipython-input-1-8b7c24be1ec9>, line 1)', 'Cell3, output');
        assert.lengthOf(errorOutput.traceback, 1, 'Cell4, output');
        assert.include(errorOutput.traceback[0], 'invalid syntax', 'Cell4, output');
        assert.equal(notebook.cells[3].metadata.executionOrder, 1, 'Cell4, execution count');
        assert.lengthOf(Object.keys(notebook.cells[3].metadata.custom || {}), 1, 'Cell4, metadata');
        assert.isEmpty(notebook.cells[3].metadata.custom?.metadata, 'Cell4, metadata');

        // Cell 5.
        assert.equal(notebook.cells[4].cellKind, vscodeNotebookEnums.CellKind.Code, 'Cell5, type');
        assert.include(notebook.cells[4].document.getText(), 'import matplotlib', 'Cell5, source');
        assert.include(notebook.cells[4].document.getText(), 'plt.show()', 'Cell5, source');
        assert.lengthOf(notebook.cells[4].outputs, 1, 'Cell5, outputs');
        assert.equal(notebook.cells[4].outputs[0].outputKind, vscodeNotebookEnums.CellOutputKind.Rich, 'Cell5, output');
        const richOutput = (notebook.cells[4].outputs[0] as unknown) as CellDisplayOutput;
        assert.containsAllKeys(
            richOutput.data,
            { 'text/plain': '', 'image/svg+xml': '', 'image/png': '' },
            'Cell5, output'
        );
        assert.deepEqual(
            richOutput.metadata?.custom,
            {
                needs_background: 'light',
                vscode: {
                    outputType: 'display_data'
                }
            },
            'Cell5, output'
        );

        // Cell 6.
        assert.equal(notebook.cells[5].cellKind, vscodeNotebookEnums.CellKind.Code, 'Cell6, type');
        assert.lengthOf(notebook.cells[5].outputs, 0, 'Cell6, outputs');
        assert.lengthOf(notebook.cells[5].document.getText(), 0, 'Cell6, source');
        assert.isUndefined(notebook.cells[5].metadata.executionOrder, 'Cell6, execution count');
        assert.lengthOf(Object.keys(notebook.cells[5].metadata.custom || {}), 1, 'Cell6, metadata');
        assert.containsAllKeys(notebook.cells[5].metadata.custom || {}, { metadata: '' }, 'Cell6, metadata');
    });
    test('Verify generation of NotebookJson', async () => {
        const editorProvider = api.serviceContainer.get<INotebookEditorProvider>(INotebookEditorProvider);
        const model = (await editorProvider.open(testIPynb))!.model!;

        const originalJsonStr = (await fs.readFile(templateIPynb, { encoding: 'utf8' })).trim();
        const originalJson: nbformat.INotebookContent = JSON.parse(originalJsonStr);
        assert.deepEqual(JSON.parse(model.getContent()), originalJson, 'Untrusted notebook json content is invalid');
        // https://github.com/microsoft/vscode-python/issues/13155
        // assert.equal(model.getContent(), originalJsonStr, 'Untrusted notebook json not identical');

        model.trust();
        assert.deepEqual(JSON.parse(model.getContent()), originalJson, 'Trusted notebook json content is invalid');
        // https://github.com/microsoft/vscode-python/issues/13155
        // assert.equal(model.getContent(), originalJsonStr, 'Trusted notebook json not identical');
    });
});
