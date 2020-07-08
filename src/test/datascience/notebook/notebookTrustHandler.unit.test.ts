// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import { teardown } from 'mocha';
import { anything, instance, mock, when } from 'ts-mockito';
import { EventEmitter, TextDocument, Uri } from 'vscode';
import { NotebookDocument } from '../../../../types/vscode-proposed';
import { IExtensionSingleActivationService } from '../../../client/activation/types';
import { IVSCodeNotebook } from '../../../client/common/application/types';
import { IFileSystem } from '../../../client/common/platform/types';
import { IDisposable } from '../../../client/common/types';
import { JupyterNotebookView } from '../../../client/datascience/notebook/constants';
import { NotebookTrustHandler } from '../../../client/datascience/notebook/notebookTrustHandler';
import {
    INotebookEditor,
    INotebookEditorProvider,
    INotebookModel,
    ITrustService
} from '../../../client/datascience/types';
import { disposeAllDisposables } from './helper';
// tslint:disable-next-line: no-var-requires no-require-imports
const vscodeNotebookEnums = require('vscode') as typeof import('vscode-proposed');

// tslint:disable: no-any
suite('Data Science - NativeNotebook TrustHandler', () => {
    let trustHandler: IExtensionSingleActivationService;
    let trustService: ITrustService;
    let vscNotebook: IVSCodeNotebook;
    let editorProvider: INotebookEditorProvider;
    let fs: IFileSystem;
    let disposables: IDisposable[];
    let onDidTrustNotebook: EventEmitter<void>;
    setup(async () => {
        disposables = [];
        trustService = mock<ITrustService>();
        vscNotebook = mock<IVSCodeNotebook>();
        editorProvider = mock<INotebookEditorProvider>();
        fs = mock<IFileSystem>();
        onDidTrustNotebook = new EventEmitter<void>();
        when(trustService.onDidSetNotebookTrust).thenReturn(onDidTrustNotebook.event);
        when(fs.arePathsSame(anything(), anything())).thenCall((a, b) => a === b); // Dirty simple file compare.
        trustHandler = new NotebookTrustHandler(
            instance(trustService),
            instance(vscNotebook),
            instance(editorProvider),
            instance(fs),
            disposables
        );

        await trustHandler.activate();
    });
    teardown(() => disposeAllDisposables(disposables));
    function assertDocumentTrust(document: NotebookDocument, trusted: boolean) {
        assert.equal(document.metadata.cellEditable, trusted);
        assert.equal(document.metadata.cellRunnable, trusted);
        assert.equal(document.metadata.editable, trusted);
        assert.equal(document.metadata.runnable, trusted);

        document.cells.forEach((cell) => {
            assert.equal(cell.metadata.editable, trusted);
            if (cell.cellKind === vscodeNotebookEnums.CellKind.Code) {
                assert.equal(cell.metadata.runnable, trusted);
            }
        });
    }
    test('Return notebook with 2 cells', async () => {
        const nb1: NotebookDocument = {
            cells: [],
            fileName: '',
            isDirty: false,
            languages: [],
            uri: Uri.file('a'),
            viewType: JupyterNotebookView,
            metadata: {
                cellEditable: false,
                cellHasExecutionOrder: true,
                cellRunnable: false,
                editable: false,
                runnable: false
            }
        };
        const nb2: NotebookDocument = Object.assign(JSON.parse(JSON.stringify(nb1)), { uri: Uri.file('b') });
        const nb2a: NotebookDocument = Object.assign(JSON.parse(JSON.stringify(nb1)), {
            uri: Uri.file('b'),
            viewType: 'AnotherViewOfDocumentIpynb'
        });
        const markdownCell = {
            cellKind: vscodeNotebookEnums.CellKind.Markdown,
            language: 'markdown',
            document: instance(mock<TextDocument>()),
            metadata: { editable: false, runnable: false },
            outputs: [],
            uri: Uri.file('1')
        };
        const codeCell = {
            cellKind: vscodeNotebookEnums.CellKind.Code,
            language: 'python',
            document: instance(mock<TextDocument>()),
            metadata: { editable: false, runnable: false },
            outputs: [],
            uri: Uri.file('1')
        };
        nb1.cells.push({ ...markdownCell, notebook: nb1 });
        nb2.cells.push({ ...JSON.parse(JSON.stringify(markdownCell)), notebook: nb2 });
        nb1.cells.push({ ...codeCell, notebook: nb1 });
        nb2.cells.push({ ...JSON.parse(JSON.stringify(codeCell)), notebook: nb2 });
        const model1 = mock<INotebookModel>();
        const model2 = mock<INotebookModel>();
        when(model1.isTrusted).thenReturn(false);
        when(model2.isTrusted).thenReturn(false);
        when(model1.file).thenReturn(Uri.file('a'));
        when(model2.file).thenReturn(Uri.file('b'));

        // Initially un-trusted.
        assertDocumentTrust(nb1, false);
        assertDocumentTrust(nb2, false);
        assertDocumentTrust(nb2a, false);

        when(vscNotebook.notebookDocuments).thenReturn([nb1, nb2]);
        const editor1 = mock<INotebookEditor>();
        const editor2 = mock<INotebookEditor>();
        when(editor1.file).thenReturn(Uri.file('a'));
        when(editor2.file).thenReturn(Uri.file('b'));
        when(editor1.model).thenReturn(instance(model1));
        when(editor2.model).thenReturn(instance(model2));
        when(editorProvider.editors).thenReturn([instance(editor1), instance(editor2)]);

        // Trigger a change, even though none of the models are still trusted.
        onDidTrustNotebook.fire();

        // Still un-trusted.
        assertDocumentTrust(nb1, false);
        assertDocumentTrust(nb2, false);
        assertDocumentTrust(nb2a, false);

        // Trigger a change, after trusting second nb/model.
        when(model2.isTrusted).thenReturn(true);
        onDidTrustNotebook.fire();

        // Nb1 is still un-trusted and nb1 is trusted.
        assertDocumentTrust(nb1, false);
        assertDocumentTrust(nb2, true);
        assertDocumentTrust(nb2a, false); // This is a document from a different content provider, we should modify this.
    });
});
