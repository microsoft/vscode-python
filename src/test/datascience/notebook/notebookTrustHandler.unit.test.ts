// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { nbformat } from '@jupyterlab/coreutils';
import { assert } from 'chai';
import { teardown } from 'mocha';
import { anything, instance, mock, when } from 'ts-mockito';
import { EventEmitter, Uri } from 'vscode';
import { NotebookDocument } from '../../../../types/vscode-proposed';
import { IExtensionSingleActivationService } from '../../../client/activation/types';
import { IVSCodeNotebook } from '../../../client/common/application/types';
import { CryptoUtils } from '../../../client/common/crypto';
import { IDisposable } from '../../../client/common/types';
import { NotebookTrustHandler } from '../../../client/datascience/notebook/notebookTrustHandler';
import {
    IDataScienceFileSystem,
    INotebookEditor,
    INotebookEditorProvider,
    ITrustService
} from '../../../client/datascience/types';
import { MockMemento } from '../../mocks/mementos';
import { createNotebookDocument, createNotebookModel, disposeAllDisposables } from './helper';
// tslint:disable-next-line: no-var-requires no-require-imports
const vscodeNotebookEnums = require('vscode') as typeof import('vscode-proposed');

// tslint:disable: no-any
suite('DataScience - NativeNotebook TrustHandler', () => {
    let trustHandler: IExtensionSingleActivationService;
    let trustService: ITrustService;
    let vscNotebook: IVSCodeNotebook;
    let editorProvider: INotebookEditorProvider;
    let fs: IDataScienceFileSystem;
    let disposables: IDisposable[];
    let onDidTrustNotebook: EventEmitter<void>;
    let testIndex = 0;
    setup(async () => {
        disposables = [];
        trustService = mock<ITrustService>();
        vscNotebook = mock<IVSCodeNotebook>();
        editorProvider = mock<INotebookEditorProvider>();
        fs = mock<IDataScienceFileSystem>();
        onDidTrustNotebook = new EventEmitter<void>();
        when(trustService.onDidSetNotebookTrust).thenReturn(onDidTrustNotebook.event);
        when(fs.areLocalPathsSame(anything(), anything())).thenCall((a, b) => a === b); // Dirty simple file compare.
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
                // In our test all code cells have outputs.
                if (trusted) {
                    assert.ok(cell.outputs.length, 'No output in trusted cell');
                } else {
                    assert.lengthOf(cell.outputs, 0, 'Cannot have output in non-trusted notebook');
                }
            }
        });
    }
    function createModels() {
        const nbJson: Partial<nbformat.INotebookContent> = {
            cells: [
                {
                    cell_type: 'markdown',
                    source: [],
                    metadata: {}
                },
                {
                    cell_type: 'code',
                    source: [],
                    metadata: {},
                    execution_count: 1,
                    outputs: [
                        {
                            output_type: 'stream',
                            name: 'stdout',
                            text: 'Hello World'
                        }
                    ]
                }
            ]
        };

        const crypto = mock(CryptoUtils);
        testIndex += 1;
        when(crypto.createHash(anything(), 'string')).thenReturn(`${testIndex}`);

        return [
            createNotebookModel(false, Uri.file('a'), new MockMemento(), instance(crypto), nbJson),
            createNotebookModel(false, Uri.file('b'), new MockMemento(), instance(crypto), nbJson)
        ];
    }
    test('When a notebook is trusted, the Notebook document is updated accordingly', async () => {
        const [model1, model2] = createModels();
        const [nb1, nb2, nbAnotherExtension] = [
            createNotebookDocument(model1),
            createNotebookDocument(model2),
            createNotebookDocument(model2, 'AnotherExtensionNotebookEditorForIpynbFile')
        ];

        // Initially un-trusted.
        assertDocumentTrust(nb1, false);
        assertDocumentTrust(nb2, false);
        assertDocumentTrust(nbAnotherExtension, false);

        when(vscNotebook.notebookDocuments).thenReturn([nb1, nb2]);
        const editor1 = mock<INotebookEditor>();
        const editor2 = mock<INotebookEditor>();
        when(editor1.file).thenReturn(model1.file);
        when(editor2.file).thenReturn(model2.file);
        when(editor1.model).thenReturn(model1);
        when(editor2.model).thenReturn(model2);
        when(editorProvider.editors).thenReturn([instance(editor1), instance(editor2)]);

        // Trigger a change, even though none of the models are still trusted.
        onDidTrustNotebook.fire();

        // Still un-trusted.
        assertDocumentTrust(nb1, false);
        assertDocumentTrust(nb2, false);
        assertDocumentTrust(nbAnotherExtension, false);

        // Trigger a change, after trusting second nb/model.
        model2.update({
            source: 'user',
            kind: 'updateTrust',
            oldDirty: model2.isDirty,
            newDirty: model2.isDirty,
            isNotebookTrusted: true
        });

        onDidTrustNotebook.fire();

        // Nb1 is still un-trusted and nb1 is trusted.
        assertDocumentTrust(nb1, false);
        assertDocumentTrust(nb2, true);
        assertDocumentTrust(nbAnotherExtension, false); // This is a document from a different content provider, we should modify this.
    });
});
