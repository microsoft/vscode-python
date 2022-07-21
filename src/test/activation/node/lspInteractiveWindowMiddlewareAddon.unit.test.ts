/* eslint-disable @typescript-eslint/no-empty-function */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import {
    NotebookCell,
    NotebookCellKind,
    NotebookDocument,
    NotebookRange,
    Position,
    Range,
    TextDocument,
    TextLine,
    Uri,
} from 'vscode';
import { expect } from 'chai';
import { anything, capture, instance, mock, verify } from 'ts-mockito';
import { LanguageClient } from 'vscode-languageclient/node';
import { LspInteractiveWindowMiddlewareAddon } from '../../../client/activation/node/lspInteractiveWindowMiddlewareAddon';
import { JupyterExtensionIntegration } from '../../../client/jupyter/jupyterIntegration';
import { IExtensions, IInstaller } from '../../../client/common/types';
import {
    IComponentAdapter,
    ICondaService,
    IInterpreterDisplay,
    IInterpreterService,
} from '../../../client/interpreter/contracts';
import { IInterpreterSelector } from '../../../client/interpreter/configuration/types';
import { IEnvironmentActivationService } from '../../../client/interpreter/activation/types';
import { ILanguageServerCache } from '../../../client/activation/types';
import { IWorkspaceService } from '../../../client/common/application/types';
import { MockMemento } from '../../mocks/mementos';

suite('Pylance Language Server - Interactive Window LSP Notebooks', () => {
    const languageClientMock = mock<LanguageClient>();
    let languageClient: LanguageClient;
    let jupyterApi: JupyterExtensionIntegration;
    let middleware: LspInteractiveWindowMiddlewareAddon;

    setup(() => {
        languageClient = instance(languageClientMock);
        jupyterApi = new JupyterExtensionIntegration(
            mock<IExtensions>(),
            mock<IInterpreterService>(),
            mock<IInterpreterSelector>(),
            mock<IInstaller>(),
            mock<IEnvironmentActivationService>(),
            mock<ILanguageServerCache>(),
            new MockMemento(),
            mock<IInterpreterDisplay>(),
            mock<IComponentAdapter>(),
            mock<IWorkspaceService>(),
            mock<ICondaService>(),
        );
        jupyterApi.registerGetNotebookUriForTextDocumentUriFunction(getNotebookUriFunction);
    });
    teardown(() => {
        middleware?.dispose();
    });

    test('Unrelated document open should be forwarded to next handler unchanged', async () => {
        middleware = makeMiddleware();

        const uri = Uri.from({ scheme: 'file', path: 'test.py' });
        const textDocument = createTextDocument(uri);

        let nextCalled = false;
        await middleware.didOpen(textDocument, async (_) => {
            nextCalled = true;
        });

        return expect(nextCalled).to.be.true;
    });

    test('Notebook-related textDocument/didOpen should be swallowed', async () => {
        middleware = makeMiddleware();

        const uri = Uri.from({ scheme: 'test-input', path: 'Test' });
        const textDocument = createTextDocument(uri);

        let nextCalled = false;
        await middleware.didOpen(textDocument, async (_) => {
            nextCalled = true;
        });

        return expect(nextCalled).to.be.false;
    });

    test('Notebook-related document should be added at end of cells in notebookDocument/didOpen', async () => {
        middleware = makeMiddleware();

        const uri = Uri.from({ scheme: 'test-input', path: 'Test' });
        const textDocument = createTextDocument(uri);

        await middleware.didOpen(textDocument, async (_) => {});

        const cellCount = 2;
        const [notebookDocument, cells] = createNotebookDocument(getNotebookUriFunction(uri)!, cellCount);
        await middleware.notebooks.didOpen(notebookDocument, cells, async (_, nextCells) => {
            expect(nextCells.length).to.be.equals(cellCount + 1);
            expect(nextCells[cellCount]).to.deep.equal({
                index: cellCount,
                notebook: notebookDocument,
                kind: NotebookCellKind.Code,
                document: textDocument,
                metadata: {},
                outputs: [],
                executionSummary: undefined,
            });
        });
    });

    test('Notebook-related document opened after notebook causes notebookDocument/didChange', async () => {
        middleware = makeMiddleware();

        const uri = Uri.from({ scheme: 'test-input', path: 'Test' });
        const textDocument = createTextDocument(uri);

        const cellCount = 2;
        const [notebookDocument, cells] = createNotebookDocument(getNotebookUriFunction(uri)!, cellCount);
        await middleware.notebooks.didOpen(notebookDocument, cells, async (_) => {});

        await middleware.didOpen(textDocument, async (_) => {});

        verify(languageClientMock.sendNotification(anything(), anything())).once();
        const message = capture(languageClientMock.sendNotification).last()[1];

        expect(message.notebookDocument.uri).to.equal(notebookDocument.uri.toString());
        expect(message.change.cells.structure).to.deep.equal({
            array: {
                start: notebookDocument.cellCount,
                deleteCount: 0,
                cells: [{ kind: NotebookCellKind.Code, document: textDocument.uri.toString() }],
            },
            didOpen: [
                {
                    uri: textDocument.uri.toString(),
                    languageId: textDocument.languageId,
                    version: textDocument.version,
                    text: textDocument.getText(),
                },
            ],
            didClose: undefined,
        });
    });

    function makeMiddleware(): LspInteractiveWindowMiddlewareAddon {
        return new LspInteractiveWindowMiddlewareAddon(() => languageClient, jupyterApi);
    }

    function getNotebookUriFunction(textDocumentUri: Uri): Uri | undefined {
        if (textDocumentUri.scheme === 'test-input') {
            return textDocumentUri.with({ scheme: 'test-notebook' });
        }

        return undefined;
    }

    function createTextDocument(uri: Uri): TextDocument {
        const textLine: TextLine = {
            lineNumber: 0,
            text: '',
            range: new Range(0, 0, 0, 0),
            rangeIncludingLineBreak: new Range(0, 0, 0, 0),
            firstNonWhitespaceCharacterIndex: 0,
            isEmptyOrWhitespace: false,
        };

        return {
            uri,
            fileName: 'foo',
            isUntitled: false,
            languageId: 'python',
            version: 0,
            isDirty: false,
            isClosed: false,
            eol: 0,
            lineCount: 0,
            save: async () => false,
            lineAt: (_: number | Position) => textLine,
            offsetAt: (position: Position) => position.character,
            positionAt: (_: number) => new Position(0, 0),
            getText: (_?: Range | undefined) => '',
            getWordRangeAtPosition: (_: Position, _a?: RegExp) => undefined,
            validateRange: (range: Range) => range,
            validatePosition: (position: Position) => position,
        };
    }

    function createNotebookDocument(uri: Uri, cellCount: number): [NotebookDocument, NotebookCell[]] {
        const cells: NotebookCell[] = [];

        const notebookDocument = {
            uri,
            notebookType: 'jupyter',
            version: 0,
            isDirty: false,
            isUntitled: false,
            isClosed: false,
            metadata: {},
            cellCount,
            cellAt: (index: number) => cells[index],
            getCells: (range?: NotebookRange) => cells.slice(range?.start, range?.end),
            save: async () => false,
        };

        for (let i = 0; i < cellCount; i = i + 1) {
            cells.push({
                index: i,
                notebook: notebookDocument,
                kind: NotebookCellKind.Code,
                document: createTextDocument(Uri.from({ scheme: 'test-cell', path: `cell${i}` })),
                metadata: {},
                outputs: [],
                executionSummary: undefined,
            });
        }

        return [notebookDocument, cells];
    }
});
