/* eslint-disable class-methods-use-this */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import {
    Disposable,
    NotebookCell,
    NotebookDocument,
    Position,
    Range,
    TextDocument,
    TextDocumentChangeEvent,
    TextDocumentContentChangeEvent,
} from 'vscode';
import {
    DidChangeNotebookDocumentNotification,
    DidChangeTextDocumentParams,
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
    textDocument: TextDocument;
}

type TextContent = Required<Required<Required<NotebookDocumentChangeEvent>['cells']>['textContent']>[0];

/**
 * This class is a temporary solution to handling intellisense and diagnostics in python based notebooks.
 *
 * It is responsible for sending requests to pylance if they are allowed.
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
            this.getClient()?.sendNotification(DidChangeNotebookDocumentNotification.type, {
                notebookDocument: { uri: notebookUri.toString(), version: 0 }, // TODO: Fix version
                change: {
                    cells: {
                        textContent: [this._asTextContentChange(event)],
                    },
                },
            });
        }
    }

    private _asChangeTextDocumentParams(arg: TextDocumentChangeEvent): DidChangeTextDocumentParams {
        // if (isTextDocument(arg)) {
        // 	let result: proto.DidChangeTextDocumentParams = {
        // 		textDocument: {
        // 			uri: _uriConverter(arg.uri),
        // 			version: arg.version
        // 		},
        // 		contentChanges: [{ text: arg.getText() }]
        // 	};
        // 	return result;
        // } else if (isTextDocumentChangeEvent(arg)) {
        const { document } = arg;
        const result: DidChangeTextDocumentParams = {
            textDocument: {
                uri: document.uri.toString(),
                version: document.version,
            },
            contentChanges: arg.contentChanges.map(
                (change): TextDocumentContentChangeEvent => {
                    const { range } = change;
                    return {
                        range: this.getClient()!.code2ProtocolConverter.asRange(range),
                        //  new Range(
                        //     new Position(range.start.line, range.start.character),
                        //     new Position(range.end.line, range.end.character),
                        // ),
                        rangeLength: change.rangeLength,
                        rangeOffset: change.rangeOffset,
                        text: change.text,
                    };
                },
            ),
        };
        return result;
        // } else {
        // 	throw Error('Unsupported text document change parameter');
        // }
    }

    private _asTextContentChange(event: TextDocumentChangeEvent): TextContent {
        const params = this._asChangeTextDocumentParams(event);
        return { document: params.textDocument, changes: params.contentChanges };
    }

    // private _asNotebookDocumentChangeEvent(event: NotebookDocumentChangeEvent): NotebookDocumentChangeEvent {
    //     const result: NotebookDocumentChangeEvent = Object.create(null);
    //     // if (event.metadata) {
    //     //     result.metadata = Converter.c2p.asMetadata(event.metadata);
    //     // }
    //     if (event.cells !== undefined) {
    //         const cells: Required<NotebookDocumentChangeEvent>['cells'] = Object.create(null);
    //         const changedCells = event.cells;
    //         // if (changedCells.structure) {
    //         //     cells.structure = {
    //         //         array: {
    //         //             start: changedCells.structure.array.start,
    //         //             deleteCount: changedCells.structure.array.deleteCount,
    //         //             cells: changedCells.structure.array.cells !== undefined ? changedCells.structure.array.cells.map(cell => Converter.c2p.asNotebookCell(cell, base)) : undefined
    //         //         },
    //         //         didOpen: changedCells.structure.didOpen !== undefined
    //         //             ? changedCells.structure.didOpen.map(cell => base.asOpenTextDocumentParams(cell.document).textDocument)
    //         //             : undefined,
    //         //         didClose: changedCells.structure.didClose !== undefined
    //         //             ? changedCells.structure.didClose.map(cell => base.asCloseTextDocumentParams(cell.document).textDocument)
    //         //             : undefined
    //         //     };
    //         // }
    //         // if (changedCells.data !== undefined) {
    //         //     cells.data = changedCells.data.map(cell => Converter.c2p.asNotebookCell(cell, base));
    //         // }
    //         if (changedCells.textContent !== undefined) {
    //             cells.textContent = changedCells.textContent.map((x) => this._asTextContentChange(x));
    //         }
    //         // if (Object.keys(cells).length > 0) {
    //         //     result.cells = cells;
    //         // }
    //     }
    //     return result;
    // }

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
            // notebookDocument.cellCount += 1;
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

        // TODO:
        // What to do with versions?
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
