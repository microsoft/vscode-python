// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as os from 'os';
import {
    CodeAction,
    CodeActionContext,
    CodeLens,
    Command,
    CompletionItem,
    CompletionList,
    Diagnostic,
    DiagnosticRelatedInformation,
    Disposable,
    DocumentHighlight,
    DocumentLink,
    DocumentSelector,
    DocumentSymbol,
    Event,
    EventEmitter,
    Hover,
    Location,
    LocationLink,
    Position,
    Range,
    SymbolInformation,
    TextDocument,
    TextDocumentChangeEvent,
    TextDocumentContentChangeEvent,
    TextEdit,
    Uri,
    WorkspaceEdit,
} from 'vscode';
import { NotebookCell, NotebookConcatTextDocument, NotebookDocument } from 'vscode-proposed';
import { IVSCodeNotebook } from '../../common/application/types';
import { IFileSystem } from '../../common/platform/types';
import { NotebookConcatDocument } from './notebookConcatDocument';

/* Used by code actions. Disabled for now.
function toRange(rangeLike: Range): Range {
    return new Range(toPosition(rangeLike.start), toPosition(rangeLike.end));
}

function toPosition(positionLike: Position): Position {
    return new Position(positionLike.line, positionLike.character);
}
*/

export class NotebookConverter implements Disposable {
    public get onDidChangeCells(): Event<TextDocumentChangeEvent> {
        return this.onDidChangeCellsEmitter.event;
    }

    private activeDocuments: Map<string, NotebookConcatDocument> = new Map<string, NotebookConcatDocument>();

    private activeDocumentsOutgoingMap: Map<string, NotebookConcatDocument> = new Map<string, NotebookConcatDocument>();

    private disposables: Disposable[] = [];

    private onDidChangeCellsEmitter = new EventEmitter<TextDocumentChangeEvent>();

    constructor(
        private api: IVSCodeNotebook,
        private fs: IFileSystem,
        private cellSelector: DocumentSelector,
        private notebookFilter: RegExp,
    ) {
        this.disposables.push(api.onDidOpenNotebookDocument(this.onDidOpenNotebook.bind(this)));
        this.disposables.push(api.onDidCloseNotebookDocument(this.onDidCloseNotebook.bind(this)));

        // Call open on all of the active notebooks too
        api.notebookDocuments.forEach(this.onDidOpenNotebook.bind(this));
    }

    private static getDocumentKey(uri: Uri): string {
        // Use the path of the doc uri. It should be the same for all cells
        if (os.platform() === 'win32') {
            return uri.fsPath.toLowerCase();
        }
        return uri.fsPath;
    }

    public dispose(): void {
        this.disposables.forEach((d) => d.dispose());
    }

    public hasCell(cell: TextDocument): boolean {
        const concat = this.getConcatDocument(cell);
        return concat?.contains(cell.uri) ?? false;
    }

    public hasFiredOpen(cell: TextDocument): boolean | undefined {
        const wrapper = this.getTextDocumentWrapper(cell);
        if (wrapper) {
            return wrapper.firedOpen;
        }
        return undefined;
    }

    public firedOpen(cell: TextDocument): void {
        const wrapper = this.getTextDocumentWrapper(cell);
        if (wrapper) {
            wrapper.firedOpen = true;
        }
    }

    public hasFiredClose(cell: TextDocument): boolean | undefined {
        const wrapper = this.getTextDocumentWrapper(cell);
        if (wrapper) {
            return wrapper.firedClose;
        }
        return undefined;
    }

    public firedClose(cell: TextDocument): void {
        const wrapper = this.getTextDocumentWrapper(cell);
        if (wrapper) {
            wrapper.firedClose = true;
            wrapper.firedOpen = false;
        }
    }

    public toIncomingDiagnosticsMap(uri: Uri, diagnostics: Diagnostic[]): Map<Uri, Diagnostic[]> {
        const wrapper = this.getWrapperFromOutgoingUri(uri);
        const result = new Map<Uri, Diagnostic[]>();

        if (wrapper) {
            // Diagnostics are supposed to be per file and are updated each time
            // Make sure to clear out old ones first
            wrapper.notebook.cells.forEach((c: NotebookCell) => {
                result.set(c.document.uri, []);
            });

            // Then for all the new ones, set their values.
            diagnostics.forEach((d) => {
                const location = wrapper.concatDocument.locationAt(d.range);
                let list = result.get(location.uri);
                if (!list) {
                    list = [];
                    result.set(location.uri, list);
                }
                list.push(this.toIncomingDiagnostic(location.uri, d));
            });
        } else {
            result.set(uri, diagnostics);
        }

        return result;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public toIncomingWorkspaceSymbols(symbols: SymbolInformation[] | null | undefined) {
        if (Array.isArray(symbols)) {
            return symbols.map(this.toIncomingWorkspaceSymbol.bind(this));
        }
        return symbols ?? undefined;
    }

    public toIncomingWorkspaceEdit(workspaceEdit: WorkspaceEdit | null | undefined): WorkspaceEdit | undefined {
        if (workspaceEdit) {
            // Translate all of the text edits into a URI map
            const translated = new Map<Uri, TextEdit[]>();
            workspaceEdit.entries().forEach(([key, values]) => {
                values.forEach((e) => {
                    // Location may move this edit to a different cell.
                    const location = this.toIncomingLocationFromRange(key, e.range);

                    // Save this in the entry
                    let list = translated.get(location.uri);
                    if (!list) {
                        list = [];
                        translated.set(location.uri, list);
                    }
                    list.push({
                        ...e,
                        range: location.range,
                    });
                });
            });

            // Add translated entries to the new edit
            const newWorkspaceEdit = new WorkspaceEdit();
            translated.forEach((v, k) => newWorkspaceEdit.set(k, v));
            return newWorkspaceEdit;
        }
        return workspaceEdit ?? undefined;
    }

    public toOutgoingDocument(cell: TextDocument): TextDocument {
        const result = this.getTextDocumentWrapper(cell);
        return result || cell;
    }

    public toOutgoingUri(cell: TextDocument | Uri): Uri {
        const uri = cell instanceof Uri ? <Uri>cell : cell.uri;
        const result = this.getTextDocumentWrapper(cell);
        return result ? result.uri : uri;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public toOutgoingChangeEvent(cellEvent: TextDocumentChangeEvent) {
        return {
            document: this.toOutgoingDocument(cellEvent.document),
            contentChanges: cellEvent.contentChanges.map(
                this.toOutgoingContentChangeEvent.bind(this, cellEvent.document),
            ),
        };
    }

    public toOutgoingPosition(cell: TextDocument, position: Position): Position {
        const concat = this.getConcatDocument(cell);
        return concat ? concat.positionAt(new Location(cell.uri, position)) : position;
    }

    public toOutgoingRange(cell: TextDocument, cellRange: Range): Range {
        const concat = this.getConcatDocument(cell);
        if (concat) {
            const startPos = concat.positionAt(new Location(cell.uri, cellRange.start));
            const endPos = concat.positionAt(new Location(cell.uri, cellRange.end));
            return new Range(startPos, endPos);
        }
        return cellRange;
    }

    public toOutgoingOffset(cell: TextDocument, offset: number): number {
        const concat = this.getConcatDocument(cell);
        if (concat) {
            const position = cell.positionAt(offset);
            const overallPosition = concat.positionAt(new Location(cell.uri, position));
            return concat.offsetAt(overallPosition);
        }
        return offset;
    }

    public toOutgoingContext(cell: TextDocument, context: CodeActionContext): CodeActionContext {
        return {
            ...context,
            diagnostics: context.diagnostics.map(this.toOutgoingDiagnostic.bind(this, cell)),
        };
    }

    public toIncomingHover(cell: TextDocument, hover: Hover | null | undefined): Hover | undefined {
        if (hover && hover.range) {
            return {
                ...hover,
                range: this.toIncomingRange(cell, hover.range),
            };
        }
        return hover ?? undefined;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public toIncomingCompletions(
        cell: TextDocument,
        completions: CompletionItem[] | CompletionList | null | undefined,
    ) {
        if (completions) {
            if (Array.isArray(completions)) {
                return completions.map(this.toIncomingCompletion.bind(this, cell));
            }
            return {
                ...completions,
                items: completions.items.map(this.toIncomingCompletion.bind(this, cell)),
            };
        }
        return completions;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public toIncomingLocations(location: Location | Location[] | LocationLink[] | null | undefined) {
        if (Array.isArray(location)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (<any>location).map(this.toIncomingLocationOrLink.bind(this));
        }
        if (location?.range) {
            return this.toIncomingLocationFromRange(location.uri, location.range);
        }
        return location;
    }

    public toIncomingHighlight(
        cell: TextDocument,
        highlight: DocumentHighlight[] | null | undefined,
    ): DocumentHighlight[] | undefined {
        if (highlight) {
            return highlight.map((h) => ({
                ...h,
                range: this.toIncomingRange(cell, h.range),
            }));
        }
        return highlight ?? undefined;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public toIncomingSymbols(cell: TextDocument, symbols: SymbolInformation[] | DocumentSymbol[] | null | undefined) {
        if (symbols && Array.isArray(symbols) && symbols.length) {
            if (symbols[0] instanceof DocumentSymbol) {
                return (<DocumentSymbol[]>symbols).map(this.toIncomingSymbolFromDocumentSymbol.bind(this, cell));
            }
            return (<SymbolInformation[]>symbols).map(this.toIncomingSymbolFromSymbolInformation.bind(this, cell));
        }
        return symbols ?? undefined;
    }

    public toIncomingSymbolFromSymbolInformation(cell: TextDocument, symbol: SymbolInformation): SymbolInformation {
        return {
            ...symbol,
            location: this.toIncomingLocationFromRange(cell, symbol.location.range),
        };
    }

    public toIncomingDiagnostic(cell: TextDocument | Uri, diagnostic: Diagnostic): Diagnostic {
        return {
            ...diagnostic,
            range: this.toIncomingRange(cell, diagnostic.range),
            relatedInformation: diagnostic.relatedInformation
                ? diagnostic.relatedInformation.map(this.toIncomingRelatedInformation.bind(this, cell))
                : undefined,
        };
    }

    // eslint-disable-next-line class-methods-use-this
    public toIncomingActions(_cell: TextDocument, actions: (Command | CodeAction)[] | null | undefined): undefined {
        if (Array.isArray(actions)) {
            // Disable for now because actions are handled directly by the LS sometimes (at least in pylance)
            // If we translate or use them they will either
            // 1) Do nothing because the LS doesn't know about the ipynb
            // 2) Crash (pylance is doing this now)
            return undefined;
        }
        return actions ?? undefined;
    }

    public toIncomingCodeLenses(cell: TextDocument, lenses: CodeLens[] | null | undefined): CodeLens[] | undefined {
        if (Array.isArray(lenses)) {
            return lenses.map((c) => ({
                ...c,
                range: this.toIncomingRange(cell, c.range),
            }));
        }
        return lenses ?? undefined;
    }

    public toIncomingEdits(cell: TextDocument, edits: TextEdit[] | null | undefined): TextEdit[] | undefined {
        if (Array.isArray(edits)) {
            return edits.map((e) => ({
                ...e,
                range: this.toIncomingRange(cell, e.range),
            }));
        }
        return edits ?? undefined;
    }

    public toIncomingRename(
        cell: TextDocument,
        rangeOrRename:
            | Range
            | {
                  range: Range;
                  placeholder: string;
              }
            | null
            | undefined,
    ):
        | Range
        | {
              range: Range;
              placeholder: string;
          }
        | undefined {
        if (rangeOrRename) {
            if (rangeOrRename instanceof Range) {
                return this.toIncomingLocationFromRange(cell, rangeOrRename).range;
            }
            return {
                ...rangeOrRename,
                range: this.toIncomingLocationFromRange(cell, rangeOrRename.range).range,
            };
        }
        return rangeOrRename ?? undefined;
    }

    public toIncomingDocumentLinks(
        cell: TextDocument,
        links: DocumentLink[] | null | undefined,
    ): DocumentLink[] | undefined {
        if (links && Array.isArray(links)) {
            return links.map((l) => {
                const uri = l.target ? l.target : cell.uri;
                const location = this.toIncomingLocationFromRange(uri, l.range);
                return {
                    ...l,
                    range: location.range,
                    target: l.target ? location.uri : undefined,
                };
            });
        }
        return links ?? undefined;
    }

    public toIncomingRange(cell: TextDocument | Uri, range: Range): Range {
        // This is dangerous as the URI is not remapped (location uri may be different)
        return this.toIncomingLocationFromRange(cell, range).range;
    }

    public toIncomingPosition(cell: TextDocument | Uri, position: Position): Position {
        // This is dangerous as the URI is not remapped (location uri may be different)
        return this.toIncomingLocationFromRange(cell, new Range(position, position)).range.start;
    }

    private getCellAtLocation(location: Location): NotebookCell | undefined {
        const key = NotebookConverter.getDocumentKey(location.uri);
        const wrapper = this.activeDocuments.get(key);
        if (wrapper) {
            return wrapper.getCellAtPosition(location.range.start);
        }
        return undefined;
    }

    private toIncomingWorkspaceSymbol(symbol: SymbolInformation): SymbolInformation {
        // Figure out what cell if any the symbol is for
        const cell = this.getCellAtLocation(symbol.location);
        if (cell) {
            return this.toIncomingSymbolFromSymbolInformation(cell.document, symbol);
        }
        return symbol;
    }

    /* Renable this if actions can be translated
    private toIncomingAction(cell: TextDocument, action: Command | CodeAction): Command | CodeAction {
        if (action instanceof CodeAction) {
            return {
                ...action,
                command: action.command ? this.toIncomingCommand(cell, action.command) : undefined,
                diagnostics: action.diagnostics
                    ? action.diagnostics.map(this.toIncomingDiagnostic.bind(this, cell))
                    : undefined
            };
        }
        return this.toIncomingCommand(cell, action);
    }

    private toIncomingCommand(cell: TextDocument, command: Command): Command {
        return {
            ...command,
            arguments: command.arguments ? command.arguments.map(this.toIncomingArgument.bind(this, cell)) : undefined
        };
    }


    private toIncomingArgument(cell: TextDocument, argument: any): any {
        // URIs in a command should be remapped to the cell document if part
        // of one of our open notebooks
        if (isUri(argument)) {
            const wrapper = this.getWrapperFromOutgoingUri(argument);
            if (wrapper) {
                return cell.uri;
            }
        }
        if (typeof argument === 'string' && argument.includes(NotebookConcatPrefix)) {
            const wrapper = this.getWrapperFromOutgoingUri(Uri.file(argument));
            if (wrapper) {
                return cell.uri;
            }
        }
        if (typeof argument === 'object' && argument.hasOwnProperty('start') && argument.hasOwnProperty('end')) {
            // This is a range like object. Convert it too.
            return this.toIncomingRange(cell, this.toRange(<Range>argument));
        }
        if (typeof argument === 'object' && argument.hasOwnProperty('line') && argument.hasOwnProperty('character')) {
            // This is a position like object. Convert it too.
            return this.toIncomingPosition(cell, this.toPosition(<Position>argument));
        }
        return argument;
    }
    */

    private toOutgoingDiagnostic(cell: TextDocument, diagnostic: Diagnostic): Diagnostic {
        return {
            ...diagnostic,
            range: this.toOutgoingRange(cell, diagnostic.range),
            relatedInformation: diagnostic.relatedInformation
                ? diagnostic.relatedInformation.map(this.toOutgoingRelatedInformation.bind(this, cell))
                : undefined,
        };
    }

    private toOutgoingRelatedInformation(
        cell: TextDocument,
        relatedInformation: DiagnosticRelatedInformation,
    ): DiagnosticRelatedInformation {
        const outgoingDoc = this.toOutgoingDocument(cell);
        return {
            ...relatedInformation,
            location:
                relatedInformation.location.uri === outgoingDoc.uri
                    ? this.toOutgoingLocation(cell, relatedInformation.location)
                    : relatedInformation.location,
        };
    }

    private toOutgoingLocation(cell: TextDocument, location: Location): Location {
        return {
            uri: this.toOutgoingDocument(cell).uri,
            range: this.toOutgoingRange(cell, location.range),
        };
    }

    private toIncomingRelatedInformation(
        cell: TextDocument | Uri,
        relatedInformation: DiagnosticRelatedInformation,
    ): DiagnosticRelatedInformation {
        const outgoingUri = this.toOutgoingUri(cell);
        return {
            ...relatedInformation,
            location:
                relatedInformation.location.uri === outgoingUri
                    ? this.toIncomingLocationFromLocation(relatedInformation.location)
                    : relatedInformation.location,
        };
    }

    private toIncomingSymbolFromDocumentSymbol(cell: TextDocument, docSymbol: DocumentSymbol): DocumentSymbol {
        return {
            ...docSymbol,
            range: this.toIncomingRange(cell, docSymbol.range),
            selectionRange: this.toIncomingRange(cell, docSymbol.selectionRange),
            children: docSymbol.children.map(this.toIncomingSymbolFromDocumentSymbol.bind(this, cell)),
        };
    }

    private toIncomingLocationFromLocation(location: Location): Location {
        if (this.locationNeedsConversion(location.uri)) {
            const uri = this.toIncomingUri(location.uri, location.range);

            return {
                uri,
                range: this.toIncomingRange(uri, location.range),
            };
        }

        return location;
    }

    private toIncomingLocationLinkFromLocationLink(locationLink: LocationLink): LocationLink {
        if (this.locationNeedsConversion(locationLink.targetUri)) {
            const uri = this.toIncomingUri(locationLink.targetUri, locationLink.targetRange);

            return {
                originSelectionRange: locationLink.originSelectionRange
                    ? this.toIncomingRange(uri, locationLink.originSelectionRange)
                    : undefined,
                targetUri: uri,
                targetRange: this.toIncomingRange(uri, locationLink.targetRange),
                targetSelectionRange: locationLink.targetSelectionRange
                    ? this.toIncomingRange(uri, locationLink.targetSelectionRange)
                    : undefined,
            };
        }

        return locationLink;
    }

    private toIncomingLocationOrLink(location: Location | LocationLink) {
        // Split on if we are dealing with a Location or a LocationLink
        if ('targetUri' in location) {
            // targetUri only for LocationLinks
            return this.toIncomingLocationLinkFromLocationLink(location);
        }
        return this.toIncomingLocationFromLocation(location);
    }

    // Returns true if the given location needs conversion
    // Should be if it's in a notebook cell or if it's in a notebook concat document
    private locationNeedsConversion(locationUri: Uri): boolean {
        return (
            locationUri.scheme === 'vscode-notebook-cell' || this.getWrapperFromOutgoingUri(locationUri) !== undefined
        );
    }

    private toIncomingUri(outgoingUri: Uri, range: Range) {
        const wrapper = this.getWrapperFromOutgoingUri(outgoingUri);
        if (wrapper) {
            const location = wrapper.concatDocument.locationAt(range);
            return location.uri;
        }
        return outgoingUri;
    }

    private toIncomingCompletion(cell: TextDocument, item: CompletionItem) {
        if (item.range) {
            if (item.range instanceof Range) {
                return {
                    ...item,
                    range: this.toIncomingRange(cell, item.range),
                };
            }
            return {
                ...item,
                range: {
                    inserting: this.toIncomingRange(cell, item.range.inserting),
                    replacing: this.toIncomingRange(cell, item.range.replacing),
                },
            };
        }
        return item;
    }

    private toIncomingLocationFromRange(cell: TextDocument | Uri, range: Range): Location {
        const uri = cell instanceof Uri ? <Uri>cell : cell.uri;
        const concatDocument = this.getConcatDocument(cell);
        if (concatDocument) {
            const startLoc = concatDocument.locationAt(range.start);
            const endLoc = concatDocument.locationAt(range.end);
            return {
                uri: startLoc.uri,
                range: new Range(startLoc.range.start, endLoc.range.end),
            };
        }
        return {
            uri,
            range,
        };
    }

    private toOutgoingContentChangeEvent(cell: TextDocument, ev: TextDocumentContentChangeEvent) {
        return {
            range: this.toOutgoingRange(cell, ev.range),
            rangeLength: ev.rangeLength,
            rangeOffset: this.toOutgoingOffset(cell, ev.rangeOffset),
            text: ev.text,
        };
    }

    private onDidOpenNotebook(doc: NotebookDocument) {
        if (this.notebookFilter.test(doc.fileName)) {
            this.getTextDocumentWrapper(doc.uri);
        }
    }

    private onDidCloseNotebook(doc: NotebookDocument) {
        if (this.notebookFilter.test(doc.fileName)) {
            const key = NotebookConverter.getDocumentKey(doc.uri);
            const wrapper = this.getTextDocumentWrapper(doc.uri);
            this.activeDocuments.delete(key);
            this.activeDocumentsOutgoingMap.delete(NotebookConverter.getDocumentKey(wrapper.uri));
        }
    }

    private getWrapperFromOutgoingUri(outgoingUri: Uri): NotebookConcatDocument | undefined {
        return this.activeDocumentsOutgoingMap.get(NotebookConverter.getDocumentKey(outgoingUri));
    }

    private getTextDocumentWrapper(cell: TextDocument | Uri): NotebookConcatDocument {
        const uri = cell instanceof Uri ? <Uri>cell : cell.uri;
        const key = NotebookConverter.getDocumentKey(uri);
        let result = this.activeDocuments.get(key);
        if (!result) {
            const doc = this.api.notebookDocuments.find((n) => this.fs.arePathsSame(uri.fsPath, n.uri.fsPath));
            if (!doc) {
                throw new Error(`Invalid uri, not a notebook: ${uri.fsPath}`);
            }
            result = new NotebookConcatDocument(doc, this.api, this.cellSelector);
            result.onCellsChanged((e) => this.onDidChangeCellsEmitter.fire(e), undefined, this.disposables);
            this.activeDocuments.set(key, result);
            this.activeDocumentsOutgoingMap.set(NotebookConverter.getDocumentKey(result.uri), result);
        }
        return result;
    }

    private getConcatDocument(cell: TextDocument | Uri): NotebookConcatTextDocument | undefined {
        return this.getTextDocumentWrapper(cell)?.concatDocument;
    }
}
