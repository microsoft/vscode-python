// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { Disposable, NotebookCell, NotebookDocument, TextDocument, TextDocumentChangeEvent } from 'vscode';
import { Converter } from 'vscode-languageclient/lib/common/codeConverter';
import {
    DidChangeNotebookDocumentNotification,
    LanguageClient,
    Middleware,
    NotebookCellKind,
    NotebookDocumentChangeEvent,
    VNotebookDocumentChangeEvent,
} from 'vscode-languageclient/node';
import * as proto from 'vscode-languageserver-protocol';

interface NotebookMetadata {
    cellCount: number;
}
interface InputBoxMetadata {
    textDocument: TextDocument;
}

type TextContent = Required<Required<Required<proto.NotebookDocumentChangeEvent>['cells']>['textContent']>[0];

/**
 * Detects the input box text documents of Interactive Windows and makes them appear to be
 * the last cell of their corresponding notebooks.
 */
export class LspInteractiveWindowMiddlewareAddon implements Middleware, Disposable {
    constructor(private readonly getClient: () => LanguageClient | undefined) {
        // Make sure a bunch of functions are bound to this. VS code can call them without a this context
        this.didOpen = this.didOpen.bind(this);
        this.didChange = this.didChange.bind(this);
        this.didClose = this.didClose.bind(this);
    }

    public dispose(): void {
        // Nothing to dispose at the moment
    }

    private notebookMetadataMap: Map<string, NotebookMetadata> = new Map<string, NotebookMetadata>();

    private unlinkedInputBoxMap: Map<string, InputBoxMetadata> = new Map<string, InputBoxMetadata>();

    public async didOpen(document: TextDocument, next: (ev: TextDocument) => void): Promise<void> {
        if (document.uri.scheme !== 'vscode-interactive-input') {
            await next(document);
            return;
        }

        const notebookPath = `${document.uri.fsPath.replace('\\InteractiveInput-', 'Interactive-')}.interactive`;
        const notebookUri = document.uri.with({ scheme: 'vscode-interactive', path: notebookPath });
        const notebookMetadata = this.notebookMetadataMap.get(notebookUri.toString());

        if (!notebookMetadata) {
            this.unlinkedInputBoxMap.set(notebookUri.toString(), { textDocument: document });
            return;
        }

        try {
            const result: NotebookDocumentChangeEvent = Object.create(null);
            const cells: Required<NotebookDocumentChangeEvent>['cells'] = Object.create(null);

            cells.structure = {
                array: {
                    start: notebookMetadata.cellCount,
                    deleteCount: 0,
                    cells: [{ kind: NotebookCellKind.Code, document: document.uri.toString() }],
                },
                didOpen: [
                    {
                        uri: document.uri.toString(),
                        languageId: 'python',
                        version: 0,
                        text: document.getText(),
                    },
                ],
                didClose: undefined,
            };

            await this.getClient()?.sendNotification(DidChangeNotebookDocumentNotification.type, {
                notebookDocument: { version: 0, uri: notebookUri.toString() }, // TODO: Fix version
                change: result,
            });
        } catch (error) {
            this.getClient()?.error('Sending DidChangeNotebookDocumentNotification failed', error);
            throw error;
        }
    }

    public async didChange(event: TextDocumentChangeEvent, next: (ev: TextDocumentChangeEvent) => void): Promise<void> {
        if (event.document.uri.scheme !== 'vscode-interactive-input') {
            await next(event);
            return;
        }

        const notebookPath = `${event.document.uri.fsPath.replace('\\InteractiveInput-', 'Interactive-')}.interactive`;
        const notebookUri = event.document.uri.with({ scheme: 'vscode-interactive', path: notebookPath });
        const notebookMetadata = this.notebookMetadataMap.get(notebookUri.toString());
        if (notebookMetadata) {
            const client = this.getClient();
            if (client) {
                client.sendNotification(proto.DidChangeNotebookDocumentNotification.type, {
                    notebookDocument: { uri: notebookUri.toString(), version: 0 }, // TODO: Fix version
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

    public async didClose(document: TextDocument, next: (ev: TextDocument) => void): Promise<void> {
        if (document.uri.scheme !== 'vscode-interactive-input') {
            await next(document);
            return;
        }

        const notebookPath = `${document.uri.fsPath.replace('\\InteractiveInput-', 'Interactive-')}.interactive`;
        const notebookUri = document.uri.with({ scheme: 'vscode-interactive', path: notebookPath });

        this.unlinkedInputBoxMap.delete(notebookUri.toString());
    }

    public async didOpenNotebook(
        notebookDocument: NotebookDocument,
        cells: NotebookCell[],
        next: (notebookDocument: NotebookDocument, cells: NotebookCell[]) => void,
    ): Promise<void> {
        if (notebookDocument.uri.scheme !== 'vscode-interactive') {
            await next(notebookDocument, cells);
            return;
        }

        this.notebookMetadataMap.set(notebookDocument.uri.toString(), { cellCount: notebookDocument.cellCount });

        const inputBoxMetadata = this.unlinkedInputBoxMap.get(notebookDocument.uri.toString());
        if (inputBoxMetadata) {
            const inputBoxIndex = notebookDocument.cellCount;
            const newCells = [
                ...cells,
                {
                    index: inputBoxIndex,
                    notebook: notebookDocument,
                    kind: NotebookCellKind.Code,
                    document: inputBoxMetadata.textDocument,
                    metadata: {},
                    outputs: [],
                    executionSummary: undefined,
                },
            ];

            this.unlinkedInputBoxMap.delete(notebookDocument.uri.toString());

            await next(notebookDocument, newCells);
        }
    }

    // eslint-disable-next-line class-methods-use-this
    public async didChangeNotebook(
        event: VNotebookDocumentChangeEvent,
        next: (event: VNotebookDocumentChangeEvent) => void,
    ): Promise<void> {
        await next(event);
    }

    public async didCloseNotebook(
        notebookDocument: NotebookDocument,
        cells: NotebookCell[],
        next: (notebookDocument: NotebookDocument, cells: NotebookCell[]) => void,
    ): Promise<void> {
        if (notebookDocument.uri.scheme === 'vscode-interactive') {
            this.notebookMetadataMap.delete(notebookDocument.uri.toString());
        }

        await next(notebookDocument, cells);
    }

    notebooks = {
        didOpen: this.didOpenNotebook.bind(this),
        didChange: this.didChangeNotebook.bind(this),
        didClose: this.didCloseNotebook.bind(this),
    };
}
