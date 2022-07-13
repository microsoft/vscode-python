/* eslint-disable class-methods-use-this */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { Disposable, NotebookCell, NotebookDocument, TextDocument, Uri } from 'vscode';
import {
    DidChangeNotebookDocumentNotification,
    LanguageClient,
    Middleware,
    NotebookCellKind,
    NotebookDocumentChangeEvent,
    VNotebookDocumentChangeEvent,
} from 'vscode-languageclient/node';

interface NotebookMetadata {
    cellCount: number;
}
interface InputBoxMetadata {
    uri: Uri;
}

/**
 * This class is a temporary solution to handling intellisense and diagnostics in python based notebooks.
 *
 * It is responsible for sending requests to pylance if they are allowed.
 */
export class LspInteractiveWindowMiddlewareAddon implements Middleware, Disposable {
    constructor(private readonly getClient: () => LanguageClient | undefined) {
        // Make sure a bunch of functions are bound to this. VS code can call them without a this context
        this.didOpen = this.didOpen.bind(this);
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
        }

        const notebookPath = `${document.uri.fsPath.replace('\\InteractiveInput-', 'Interactive-')}.interactive`;
        const notebookUri = document.uri.with({ scheme: 'vscode-interactive', path: notebookPath });
        const notebookMetadata = this.notebookMetadataMap.get(notebookUri.toString());

        if (!notebookMetadata) {
            this.unlinkedInputBoxMap.set(notebookUri.toString(), { uri: document.uri });
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
                notebookDocument: { version: 0, uri: notebookUri.toString() },
                change: result,
            });
        } catch (error) {
            this.getClient()?.error('Sending DidChangeNotebookDocumentNotification failed', error);
            throw error;
        }
    }

    public async didClose(document: TextDocument, next: (ev: TextDocument) => void): Promise<void> {
        await next(document);
    }

    public async didOpenNotebook(
        notebookDocument: NotebookDocument,
        cells: NotebookCell[],
        next: (notebookDocument: NotebookDocument, cells: NotebookCell[]) => void,
    ): Promise<void> {
        await next(notebookDocument, cells);

        // TODO:
        // What to do with versions?
        // Maybe change the didOpen message instead of adding didChange?

        if (notebookDocument.uri.scheme === 'vscode-interactive') {
            this.notebookMetadataMap.set(notebookDocument.uri.toString(), { cellCount: notebookDocument.cellCount });

            const inputBoxMetadata = this.unlinkedInputBoxMap.get(notebookDocument.uri.toString());
            if (inputBoxMetadata) {
                this.getClient()?.sendNotification(DidChangeNotebookDocumentNotification.method, {
                    notebookDocument: { uri: notebookDocument.uri, version: 0 },
                    change: {
                        cells: {
                            structure: {
                                array: {
                                    start: notebookDocument.cellCount,
                                    deleteCount: 0,
                                    cells: [{ kind: NotebookCellKind.Code, document: inputBoxMetadata.uri }],
                                },
                                didOpen: [{ uri: inputBoxMetadata.uri, languageId: 'python', version: 0 }],
                            },
                        },
                    },
                });

                this.unlinkedInputBoxMap.delete(notebookDocument.uri.toString());
            }
        }
    }

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
