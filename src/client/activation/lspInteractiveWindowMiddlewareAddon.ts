/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable class-methods-use-this */
/* eslint-disable consistent-return */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import {
    CallHierarchyIncomingCall,
    CallHierarchyItem,
    CallHierarchyOutgoingCall,
    CancellationToken,
    CodeAction,
    CodeActionContext,
    CodeLens,
    Color,
    ColorInformation,
    ColorPresentation,
    Command,
    CompletionContext,
    CompletionItem,
    Declaration,
    Definition,
    DefinitionLink,
    Diagnostic,
    Disposable,
    DocumentHighlight,
    DocumentLink,
    DocumentSymbol,
    FoldingContext,
    FoldingRange,
    FormattingOptions,
    LinkedEditingRanges,
    Location,
    NotebookCell,
    NotebookDocument,
    Position,
    Position as VPosition,
    ProviderResult,
    Range,
    SelectionRange,
    SemanticTokens,
    SemanticTokensEdits,
    SignatureHelp,
    SignatureHelpContext,
    SymbolInformation,
    TextDocument,
    TextEdit,
    Uri,
    WorkspaceEdit,
} from 'vscode';
import {
    ConfigurationParams,
    ConfigurationRequest,
    DidChangeNotebookDocumentNotification,
    HandleDiagnosticsSignature,
    LanguageClient,
    Middleware,
    NotebookCellKind,
    NotebookDocumentChangeEvent,
    VNotebookDocumentChangeEvent,
} from 'vscode-languageclient/node';

import { ProvideDeclarationSignature } from 'vscode-languageclient/lib/common/declaration';
import { ProvideTypeDefinitionSignature } from 'vscode-languageclient/lib/common/typeDefinition';
import { ProvideImplementationSignature } from 'vscode-languageclient/lib/common/implementation';
import {
    ProvideDocumentColorsSignature,
    ProvideColorPresentationSignature,
} from 'vscode-languageclient/lib/common/colorProvider';
import { ProvideFoldingRangeSignature } from 'vscode-languageclient/lib/common/foldingRange';
import { ProvideSelectionRangeSignature } from 'vscode-languageclient/lib/common/selectionRange';
import {
    PrepareCallHierarchySignature,
    CallHierarchyIncomingCallsSignature,
    CallHierarchyOutgoingCallsSignature,
} from 'vscode-languageclient/lib/common/callHierarchy';
import {
    DocumentRangeSemanticTokensSignature,
    DocumentSemanticsTokensEditsSignature,
    DocumentSemanticsTokensSignature,
} from 'vscode-languageclient/lib/common/semanticTokens';
import { ProvideLinkedEditingRangeSignature } from 'vscode-languageclient/lib/common/linkedEditingRange';
import { ProvideCodeActionsSignature } from 'vscode-languageclient/lib/common/codeAction';
import { ProvideCodeLensesSignature, ResolveCodeLensSignature } from 'vscode-languageclient/lib/common/codeLens';
import {
    ProvideCompletionItemsSignature,
    ResolveCompletionItemSignature,
} from 'vscode-languageclient/lib/common/completion';
import { ProvideDefinitionSignature } from 'vscode-languageclient/lib/common/definition';
import { ProvideDocumentHighlightsSignature } from 'vscode-languageclient/lib/common/documentHighlight';
import {
    ProvideDocumentLinksSignature,
    ResolveDocumentLinkSignature,
} from 'vscode-languageclient/lib/common/documentLink';
import { ProvideDocumentSymbolsSignature } from 'vscode-languageclient/lib/common/documentSymbol';
import {
    ProvideDocumentFormattingEditsSignature,
    ProvideDocumentRangeFormattingEditsSignature,
    ProvideOnTypeFormattingEditsSignature,
} from 'vscode-languageclient/lib/common/formatting';
import { ProvideHoverSignature } from 'vscode-languageclient/lib/common/hover';
import { ProvideReferencesSignature } from 'vscode-languageclient/lib/common/reference';
import { ProvideRenameEditsSignature, PrepareRenameSignature } from 'vscode-languageclient/lib/common/rename';
import { ProvideSignatureHelpSignature } from 'vscode-languageclient/lib/common/signatureHelp';
import { ProvideWorkspaceSymbolsSignature } from 'vscode-languageclient/lib/common/workspaceSymbol';

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
        this.handleDiagnostics = this.handleDiagnostics.bind(this);
        this.didOpen = this.didOpen.bind(this);
        this.didClose = this.didClose.bind(this);
    }

    public workspace = {
        configuration: async (
            params: ConfigurationParams,
            token: CancellationToken,
            next: ConfigurationRequest.HandlerSignature,
        ) => next(params, token),
    };

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
        if (notebookDocument.uri.scheme === 'vscode-interactive') {
            this.notebookMetadataMap.set(notebookDocument.uri.toString(), { cellCount: notebookDocument.cellCount });

            const inputBoxMetadata = this.unlinkedInputBoxMap.get(notebookDocument.uri.toString());
            if (inputBoxMetadata) {
                this.getClient()?.sendNotification(DidChangeNotebookDocumentNotification.method, {
                    notebookDocument: notebookDocument.uri,
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

        await next(notebookDocument, cells);
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

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public provideCompletionItem(
        document: TextDocument,
        position: Position,
        context: CompletionContext,
        token: CancellationToken,
        next: ProvideCompletionItemsSignature,
    ) {
        return next(document, position, context, token);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public provideHover(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        next: ProvideHoverSignature,
    ) {
        return next(document, position, token);
    }

    // eslint-disable-next-line class-methods-use-this
    public resolveCompletionItem(
        item: CompletionItem,
        token: CancellationToken,
        next: ResolveCompletionItemSignature,
    ): ProviderResult<CompletionItem> {
        // Range should have already been remapped.

        // TODO: What if the LS needs to read the range? It won't make sense. This might mean
        // doing this at the extension level is not possible.
        return next(item, token);
    }

    public provideSignatureHelp(
        document: TextDocument,
        position: Position,
        context: SignatureHelpContext,
        token: CancellationToken,
        next: ProvideSignatureHelpSignature,
    ): ProviderResult<SignatureHelp> {
        return next(document, position, context, token);
    }

    public provideDefinition(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        next: ProvideDefinitionSignature,
    ): ProviderResult<Definition | DefinitionLink[]> {
        return next(document, position, token);
    }

    public provideReferences(
        document: TextDocument,
        position: Position,
        options: {
            includeDeclaration: boolean;
        },
        token: CancellationToken,
        next: ProvideReferencesSignature,
    ): ProviderResult<Location[]> {
        return next(document, position, options, token);
    }

    public provideDocumentHighlights(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        next: ProvideDocumentHighlightsSignature,
    ): ProviderResult<DocumentHighlight[]> {
        return next(document, position, token);
    }

    public provideDocumentSymbols(
        document: TextDocument,
        token: CancellationToken,
        next: ProvideDocumentSymbolsSignature,
    ): ProviderResult<SymbolInformation[] | DocumentSymbol[]> {
        return next(document, token);
    }

    public provideWorkspaceSymbols(
        query: string,
        token: CancellationToken,
        next: ProvideWorkspaceSymbolsSignature,
    ): ProviderResult<SymbolInformation[]> {
        // Is this one possible to check?
        return next(query, token);
    }

    // eslint-disable-next-line class-methods-use-this
    public provideCodeActions(
        document: TextDocument,
        range: Range,
        context: CodeActionContext,
        token: CancellationToken,
        next: ProvideCodeActionsSignature,
    ): ProviderResult<(Command | CodeAction)[]> {
        return next(document, range, context, token);
    }

    // eslint-disable-next-line class-methods-use-this
    public provideCodeLenses(
        document: TextDocument,
        token: CancellationToken,
        next: ProvideCodeLensesSignature,
    ): ProviderResult<CodeLens[]> {
        return next(document, token);
    }

    // eslint-disable-next-line class-methods-use-this
    public resolveCodeLens(
        codeLens: CodeLens,
        token: CancellationToken,
        next: ResolveCodeLensSignature,
    ): ProviderResult<CodeLens> {
        // Range should have already been remapped.

        // TODO: What if the LS needs to read the range? It won't make sense. This might mean
        // doing this at the extension level is not possible.
        return next(codeLens, token);
    }

    // eslint-disable-next-line class-methods-use-this
    public provideDocumentFormattingEdits(
        document: TextDocument,
        options: FormattingOptions,
        token: CancellationToken,
        next: ProvideDocumentFormattingEditsSignature,
    ): ProviderResult<TextEdit[]> {
        return next(document, options, token);
    }

    // eslint-disable-next-line class-methods-use-this
    public provideDocumentRangeFormattingEdits(
        document: TextDocument,
        range: Range,
        options: FormattingOptions,
        token: CancellationToken,
        next: ProvideDocumentRangeFormattingEditsSignature,
    ): ProviderResult<TextEdit[]> {
        return next(document, range, options, token);
    }

    // eslint-disable-next-line class-methods-use-this
    public provideOnTypeFormattingEdits(
        document: TextDocument,
        position: Position,
        ch: string,
        options: FormattingOptions,
        token: CancellationToken,
        next: ProvideOnTypeFormattingEditsSignature,
    ): ProviderResult<TextEdit[]> {
        return next(document, position, ch, options, token);
    }

    // eslint-disable-next-line class-methods-use-this
    public provideRenameEdits(
        document: TextDocument,
        position: Position,
        newName: string,
        token: CancellationToken,
        next: ProvideRenameEditsSignature,
    ): ProviderResult<WorkspaceEdit> {
        return next(document, position, newName, token);
    }

    // eslint-disable-next-line class-methods-use-this
    public prepareRename(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        next: PrepareRenameSignature,
    ): ProviderResult<
        | Range
        | {
              range: Range;
              placeholder: string;
          }
    > {
        return next(document, position, token);
    }

    // eslint-disable-next-line class-methods-use-this
    public provideDocumentLinks(
        document: TextDocument,
        token: CancellationToken,
        next: ProvideDocumentLinksSignature,
    ): ProviderResult<DocumentLink[]> {
        return next(document, token);
    }

    // eslint-disable-next-line class-methods-use-this
    public resolveDocumentLink(
        link: DocumentLink,
        token: CancellationToken,
        next: ResolveDocumentLinkSignature,
    ): ProviderResult<DocumentLink> {
        // Range should have already been remapped.

        // TODO: What if the LS needs to read the range? It won't make sense. This might mean
        // doing this at the extension level is not possible.
        return next(link, token);
    }

    public handleDiagnostics(uri: Uri, diagnostics: Diagnostic[], next: HandleDiagnosticsSignature): void {
        return next(uri, diagnostics);
    }

    public provideTypeDefinition(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        next: ProvideTypeDefinitionSignature,
    ) {
        return next(document, position, token);
    }

    public provideImplementation(
        document: TextDocument,
        position: VPosition,
        token: CancellationToken,
        next: ProvideImplementationSignature,
    ): ProviderResult<Definition | DefinitionLink[]> {
        return next(document, position, token);
    }

    public provideDocumentColors(
        document: TextDocument,
        token: CancellationToken,
        next: ProvideDocumentColorsSignature,
    ): ProviderResult<ColorInformation[]> {
        return next(document, token);
    }

    public provideColorPresentations(
        color: Color,
        context: {
            document: TextDocument;
            range: Range;
        },
        token: CancellationToken,
        next: ProvideColorPresentationSignature,
    ): ProviderResult<ColorPresentation[]> {
        return next(color, context, token);
    }

    public provideFoldingRanges(
        document: TextDocument,
        context: FoldingContext,
        token: CancellationToken,
        next: ProvideFoldingRangeSignature,
    ): ProviderResult<FoldingRange[]> {
        return next(document, context, token);
    }

    public provideDeclaration(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        next: ProvideDeclarationSignature,
    ): ProviderResult<Declaration> {
        return next(document, position, token);
    }

    public provideSelectionRanges(
        document: TextDocument,
        positions: readonly Position[],
        token: CancellationToken,
        next: ProvideSelectionRangeSignature,
    ): ProviderResult<SelectionRange[]> {
        return next(document, positions, token);
    }

    public prepareCallHierarchy(
        document: TextDocument,
        positions: Position,
        token: CancellationToken,
        next: PrepareCallHierarchySignature,
    ): ProviderResult<CallHierarchyItem | CallHierarchyItem[]> {
        return next(document, positions, token);
    }

    public provideCallHierarchyIncomingCalls(
        item: CallHierarchyItem,
        token: CancellationToken,
        next: CallHierarchyIncomingCallsSignature,
    ): ProviderResult<CallHierarchyIncomingCall[]> {
        return next(item, token);
    }

    public provideCallHierarchyOutgoingCalls(
        item: CallHierarchyItem,
        token: CancellationToken,
        next: CallHierarchyOutgoingCallsSignature,
    ): ProviderResult<CallHierarchyOutgoingCall[]> {
        return next(item, token);
    }

    public provideDocumentSemanticTokens(
        document: TextDocument,
        token: CancellationToken,
        next: DocumentSemanticsTokensSignature,
    ): ProviderResult<SemanticTokens> {
        return next(document, token);
    }

    public provideDocumentSemanticTokensEdits(
        document: TextDocument,
        previousResultId: string,
        token: CancellationToken,
        next: DocumentSemanticsTokensEditsSignature,
    ): ProviderResult<SemanticTokensEdits | SemanticTokens> {
        return next(document, previousResultId, token);
    }

    public provideDocumentRangeSemanticTokens(
        document: TextDocument,
        range: Range,
        token: CancellationToken,
        next: DocumentRangeSemanticTokensSignature,
    ): ProviderResult<SemanticTokens> {
        return next(document, range, token);
    }

    public provideLinkedEditingRange(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        next: ProvideLinkedEditingRangeSignature,
    ): ProviderResult<LinkedEditingRanges> {
        return next(document, position, token);
    }
}
