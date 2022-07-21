// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { Disposable, NotebookCell, NotebookDocument, TextDocument, TextDocumentChangeEvent, Uri } from 'vscode';
import { Converter } from 'vscode-languageclient/lib/common/codeConverter';
import {
    DidChangeNotebookDocumentNotification,
    LanguageClient,
    Middleware,
    NotebookCellKind,
    NotebookDocumentChangeEvent,
} from 'vscode-languageclient/node';
import * as proto from 'vscode-languageserver-protocol';
import { JupyterExtensionIntegration } from '../../jupyter/jupyterIntegration';

type TextContent = Required<Required<Required<proto.NotebookDocumentChangeEvent>['cells']>['textContent']>[0];

/**
 * Detects the input box text documents of Interactive Windows and makes them appear to be
 * the last cell of their corresponding notebooks.
 */
export class LspInteractiveWindowMiddlewareAddon implements Middleware, Disposable {
    constructor(
        private readonly getClient: () => LanguageClient | undefined,
        private readonly jupyterExtensionIntegration: JupyterExtensionIntegration,
    ) {
        // Make sure a bunch of functions are bound to this. VS code can call them without a this context
        this.didOpen = this.didOpen.bind(this);
        this.didChange = this.didChange.bind(this);
        this.didClose = this.didClose.bind(this);
    }

    public dispose(): void {
        // Nothing to dispose at the moment
    }

    // Map of document URIs to NotebookDocuments for all known notebooks.
    private notebookDocumentMap: Map<string, NotebookDocument> = new Map<string, NotebookDocument>();

    // Map of document URIs to TextDocuments that should be linked to a notebook
    // whose didOpen we're expecting to see in the future.
    private unlinkedTextDocumentMap: Map<string, TextDocument> = new Map<string, TextDocument>();

    public async didOpen(document: TextDocument, next: (ev: TextDocument) => Promise<void>): Promise<void> {
        const notebookUri = this.getNotebookUriForTextDocumentUri(document.uri);
        if (!notebookUri) {
            await next(document);
            return;
        }

        const notebookDocument = this.notebookDocumentMap.get(notebookUri.toString());
        if (!notebookDocument) {
            this.unlinkedTextDocumentMap.set(notebookUri.toString(), document);
            return;
        }

        try {
            const result: NotebookDocumentChangeEvent = {
                cells: {
                    structure: {
                        array: {
                            start: notebookDocument.cellCount,
                            deleteCount: 0,
                            cells: [{ kind: NotebookCellKind.Code, document: document.uri.toString() }],
                        },
                        didOpen: [
                            {
                                uri: document.uri.toString(),
                                languageId: document.languageId,
                                version: document.version,
                                text: document.getText(),
                            },
                        ],
                        didClose: undefined,
                    },
                },
            };

            await this.getClient()?.sendNotification(DidChangeNotebookDocumentNotification.type, {
                notebookDocument: { version: notebookDocument.version, uri: notebookUri.toString() },
                change: result,
            });
        } catch (error) {
            this.getClient()?.error('Sending DidChangeNotebookDocumentNotification failed', error);
            throw error;
        }
    }

    public async didChange(
        event: TextDocumentChangeEvent,
        next: (ev: TextDocumentChangeEvent) => Promise<void>,
    ): Promise<void> {
        const notebookUri = this.getNotebookUriForTextDocumentUri(event.document.uri);
        if (!notebookUri) {
            await next(event);
            return;
        }

        const notebookDocument = this.notebookDocumentMap.get(notebookUri.toString());
        if (notebookDocument) {
            const client = this.getClient();
            if (client) {
                client.sendNotification(proto.DidChangeNotebookDocumentNotification.type, {
                    notebookDocument: { uri: notebookUri.toString(), version: notebookDocument.version },
                    change: {
                        cells: {
                            textContent: [
                                LspInteractiveWindowMiddlewareAddon._asTextContentChange(
                                    event,
                                    client.code2ProtocolConverter,
                                ),
                            ],
                        },
                    },
                });
            }
        }
    }

    private static _asTextContentChange(event: TextDocumentChangeEvent, c2pConverter: Converter): TextContent {
        const params = c2pConverter.asChangeTextDocumentParams(event);
        return { document: params.textDocument, changes: params.contentChanges };
    }

    public async didClose(document: TextDocument, next: (ev: TextDocument) => Promise<void>): Promise<void> {
        const notebookUri = this.getNotebookUriForTextDocumentUri(document.uri);
        if (!notebookUri) {
            await next(document);
            return;
        }

        this.unlinkedTextDocumentMap.delete(notebookUri.toString());
    }

    public async didOpenNotebook(
        notebookDocument: NotebookDocument,
        cells: NotebookCell[],
        next: (notebookDocument: NotebookDocument, cells: NotebookCell[]) => Promise<void>,
    ): Promise<void> {
        this.notebookDocumentMap.set(notebookDocument.uri.toString(), notebookDocument);

        const relatedTextDocument = this.unlinkedTextDocumentMap.get(notebookDocument.uri.toString());
        if (relatedTextDocument) {
            const newCells = [
                ...cells,
                {
                    index: notebookDocument.cellCount,
                    notebook: notebookDocument,
                    kind: NotebookCellKind.Code,
                    document: relatedTextDocument,
                    metadata: {},
                    outputs: [],
                    executionSummary: undefined,
                },
            ];

            this.unlinkedTextDocumentMap.delete(notebookDocument.uri.toString());

            await next(notebookDocument, newCells);
        } else {
            await next(notebookDocument, cells);
        }
    }

    public async didCloseNotebook(
        notebookDocument: NotebookDocument,
        cells: NotebookCell[],
        next: (notebookDocument: NotebookDocument, cells: NotebookCell[]) => Promise<void>,
    ): Promise<void> {
        this.notebookDocumentMap.delete(notebookDocument.uri.toString());

        await next(notebookDocument, cells);
    }

    notebooks = {
        didOpen: this.didOpenNotebook.bind(this),
        didClose: this.didCloseNotebook.bind(this),
    };

    private getNotebookUriForTextDocumentUri(textDocumentUri: Uri): Uri | undefined {
        const getNotebookUriFunction = this.jupyterExtensionIntegration.getGetNotebookUriForTextDocumentUriFunction();
        if (!getNotebookUriFunction) {
            return undefined;
        }

        return getNotebookUriFunction(textDocumentUri);
    }
}
