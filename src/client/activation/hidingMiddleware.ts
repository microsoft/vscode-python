/* eslint-disable consistent-return */
/* eslint-disable class-methods-use-this */
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
    Declaration as VDeclaration,
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
    TextDocumentChangeEvent,
    TextEdit,
    Uri,
    WorkspaceEdit,
} from 'vscode';
import { HandleDiagnosticsSignature, Middleware } from 'vscode-languageclient/node';

import { ProvideDeclarationSignature } from 'vscode-languageclient/lib/common/declaration';
import {
    PrepareCallHierarchySignature,
    CallHierarchyIncomingCallsSignature,
    CallHierarchyOutgoingCallsSignature,
} from 'vscode-languageclient/lib/common/callHierarchy';
import {
    ProvideDocumentColorsSignature,
    ProvideColorPresentationSignature,
} from 'vscode-languageclient/lib/common/colorProvider';
import { ProvideFoldingRangeSignature } from 'vscode-languageclient/lib/common/foldingRange';
import { ProvideImplementationSignature } from 'vscode-languageclient/lib/common/implementation';
import { ProvideLinkedEditingRangeSignature } from 'vscode-languageclient/lib/common/linkedEditingRange';
import { ProvideSelectionRangeSignature } from 'vscode-languageclient/lib/common/selectionRange';
import {
    DocumentSemanticsTokensSignature,
    DocumentSemanticsTokensEditsSignature,
    DocumentRangeSemanticTokensSignature,
} from 'vscode-languageclient/lib/common/semanticTokens';
import { ProvideTypeDefinitionSignature } from 'vscode-languageclient/lib/common/typeDefinition';
import { ProvideHoverSignature } from 'vscode-languageclient/lib/common/hover';
import {
    ProvideCompletionItemsSignature,
    ResolveCompletionItemSignature,
} from 'vscode-languageclient/lib/common/completion';
import { ProvideDefinitionSignature } from 'vscode-languageclient/lib/common/definition';
import { ProvideDocumentHighlightsSignature } from 'vscode-languageclient/lib/common/documentHighlight';
import { ProvideReferencesSignature } from 'vscode-languageclient/lib/common/reference';
import { ProvideDocumentSymbolsSignature } from 'vscode-languageclient/lib/common/documentSymbol';
import { ProvideCodeActionsSignature } from 'vscode-languageclient/lib/common/codeAction';
import { ProvideCodeLensesSignature } from 'vscode-languageclient/lib/common/codeLens';
import { ProvideDocumentLinksSignature } from 'vscode-languageclient/lib/common/documentLink';
import {
    ProvideDocumentFormattingEditsSignature,
    ProvideDocumentRangeFormattingEditsSignature,
    ProvideOnTypeFormattingEditsSignature,
} from 'vscode-languageclient/lib/common/formatting';
import { ProvideRenameEditsSignature, PrepareRenameSignature } from 'vscode-languageclient/lib/common/rename';
import { ProvideSignatureHelpSignature } from 'vscode-languageclient/lib/common/signatureHelp';
import { isNotebookCell } from '../common/utils/misc';

/**
 * This class is used to hide all intellisense requests for notebook cells.
 */
class HidingMiddlewareAddon implements Middleware, Disposable {
    constructor() {
        // Make sure a bunch of functions are bound to this. VS code can call them without a this context
        this.handleDiagnostics = this.handleDiagnostics.bind(this);
        this.didOpen = this.didOpen.bind(this);
        this.didSave = this.didSave.bind(this);
        this.didChange = this.didChange.bind(this);
        this.didClose = this.didClose.bind(this);
    }

    public dispose(): void {
        // Nothing to dispose at the moment
    }

    public async didChange(event: TextDocumentChangeEvent, next: (ev: TextDocumentChangeEvent) => void): Promise<void> {
        if (!isNotebookCell(event.document.uri)) {
            return next(event);
        }
    }

    public async didOpen(document: TextDocument, next: (ev: TextDocument) => void): Promise<void> {
        if (!isNotebookCell(document.uri)) {
            return next(document);
        }
    }

    public async didClose(document: TextDocument, next: (ev: TextDocument) => void): Promise<void> {
        if (!isNotebookCell(document.uri)) {
            return next(document);
        }
    }

    // eslint-disable-next-line class-methods-use-this
    public async didSave(event: TextDocument, next: (ev: TextDocument) => void): Promise<void> {
        if (!isNotebookCell(event.uri)) {
            return next(event);
        }
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public provideCompletionItem(
        document: TextDocument,
        position: Position,
        context: CompletionContext,
        token: CancellationToken,
        next: ProvideCompletionItemsSignature,
    ) {
        if (!isNotebookCell(document.uri)) {
            return next(document, position, context, token);
        }
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public provideHover(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        next: ProvideHoverSignature,
    ) {
        if (!isNotebookCell(document.uri)) {
            return next(document, position, token);
        }
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
        if (!isNotebookCell(document.uri)) {
            return next(document, position, context, token);
        }
    }

    public provideDefinition(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        next: ProvideDefinitionSignature,
    ): ProviderResult<Definition | DefinitionLink[]> {
        if (!isNotebookCell(document.uri)) {
            return next(document, position, token);
        }
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
        if (!isNotebookCell(document.uri)) {
            return next(document, position, options, token);
        }
    }

    public provideDocumentHighlights(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        next: ProvideDocumentHighlightsSignature,
    ): ProviderResult<DocumentHighlight[]> {
        if (!isNotebookCell(document.uri)) {
            return next(document, position, token);
        }
    }

    public provideDocumentSymbols(
        document: TextDocument,
        token: CancellationToken,
        next: ProvideDocumentSymbolsSignature,
    ): ProviderResult<SymbolInformation[] | DocumentSymbol[]> {
        if (!isNotebookCell(document.uri)) {
            return next(document, token);
        }
    }

    // eslint-disable-next-line class-methods-use-this
    public provideCodeActions(
        document: TextDocument,
        range: Range,
        context: CodeActionContext,
        token: CancellationToken,
        next: ProvideCodeActionsSignature,
    ): ProviderResult<(Command | CodeAction)[]> {
        if (!isNotebookCell(document.uri)) {
            return next(document, range, context, token);
        }
    }

    // eslint-disable-next-line class-methods-use-this
    public provideCodeLenses(
        document: TextDocument,
        token: CancellationToken,
        next: ProvideCodeLensesSignature,
    ): ProviderResult<CodeLens[]> {
        if (!isNotebookCell(document.uri)) {
            return next(document, token);
        }
    }

    // eslint-disable-next-line class-methods-use-this
    public provideDocumentFormattingEdits(
        document: TextDocument,
        options: FormattingOptions,
        token: CancellationToken,
        next: ProvideDocumentFormattingEditsSignature,
    ): ProviderResult<TextEdit[]> {
        if (!isNotebookCell(document.uri)) {
            return next(document, options, token);
        }
    }

    // eslint-disable-next-line class-methods-use-this
    public provideDocumentRangeFormattingEdits(
        document: TextDocument,
        range: Range,
        options: FormattingOptions,
        token: CancellationToken,
        next: ProvideDocumentRangeFormattingEditsSignature,
    ): ProviderResult<TextEdit[]> {
        if (!isNotebookCell(document.uri)) {
            return next(document, range, options, token);
        }
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
        if (!isNotebookCell(document.uri)) {
            return next(document, position, ch, options, token);
        }
    }

    // eslint-disable-next-line class-methods-use-this
    public provideRenameEdits(
        document: TextDocument,
        position: Position,
        newName: string,
        token: CancellationToken,
        next: ProvideRenameEditsSignature,
    ): ProviderResult<WorkspaceEdit> {
        if (!isNotebookCell(document.uri)) {
            return next(document, position, newName, token);
        }
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
        if (!isNotebookCell(document.uri)) {
            return next(document, position, token);
        }
    }

    // eslint-disable-next-line class-methods-use-this
    public provideDocumentLinks(
        document: TextDocument,
        token: CancellationToken,
        next: ProvideDocumentLinksSignature,
    ): ProviderResult<DocumentLink[]> {
        if (!isNotebookCell(document.uri)) {
            return next(document, token);
        }
    }

    // eslint-disable-next-line class-methods-use-this
    public provideDeclaration(
        document: TextDocument,
        position: VPosition,
        token: CancellationToken,
        next: ProvideDeclarationSignature,
    ): ProviderResult<VDeclaration> {
        if (!isNotebookCell(document.uri)) {
            return next(document, position, token);
        }
    }

    public handleDiagnostics(uri: Uri, diagnostics: Diagnostic[], next: HandleDiagnosticsSignature): void {
        if (isNotebookCell(uri)) {
            // Swallow all diagnostics for cells
            next(uri, []);
        } else {
            next(uri, diagnostics);
        }
    }

    public provideTypeDefinition(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        next: ProvideTypeDefinitionSignature,
    ): ProviderResult<Definition | DefinitionLink[]> {
        if (!isNotebookCell(document.uri)) {
            return next(document, position, token);
        }
    }

    public provideImplementation(
        document: TextDocument,
        position: VPosition,
        token: CancellationToken,
        next: ProvideImplementationSignature,
    ): ProviderResult<Definition | DefinitionLink[]> {
        if (!isNotebookCell(document.uri)) {
            return next(document, position, token);
        }
    }

    public provideDocumentColors(
        document: TextDocument,
        token: CancellationToken,
        next: ProvideDocumentColorsSignature,
    ): ProviderResult<ColorInformation[]> {
        if (!isNotebookCell(document.uri)) {
            return next(document, token);
        }
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
        if (!isNotebookCell(context.document.uri)) {
            return next(color, context, token);
        }
    }

    public provideFoldingRanges(
        document: TextDocument,
        context: FoldingContext,
        token: CancellationToken,
        next: ProvideFoldingRangeSignature,
    ): ProviderResult<FoldingRange[]> {
        if (!isNotebookCell(document.uri)) {
            return next(document, context, token);
        }
    }

    public provideSelectionRanges(
        document: TextDocument,
        positions: readonly Position[],
        token: CancellationToken,
        next: ProvideSelectionRangeSignature,
    ): ProviderResult<SelectionRange[]> {
        if (!isNotebookCell(document.uri)) {
            return next(document, positions, token);
        }
    }

    public prepareCallHierarchy(
        document: TextDocument,
        positions: Position,
        token: CancellationToken,
        next: PrepareCallHierarchySignature,
    ): ProviderResult<CallHierarchyItem | CallHierarchyItem[]> {
        if (!isNotebookCell(document.uri)) {
            return next(document, positions, token);
        }
    }

    public provideCallHierarchyIncomingCalls(
        item: CallHierarchyItem,
        token: CancellationToken,
        next: CallHierarchyIncomingCallsSignature,
    ): ProviderResult<CallHierarchyIncomingCall[]> {
        if (!isNotebookCell(item.uri)) {
            return next(item, token);
        }
    }

    public provideCallHierarchyOutgoingCalls(
        item: CallHierarchyItem,
        token: CancellationToken,
        next: CallHierarchyOutgoingCallsSignature,
    ): ProviderResult<CallHierarchyOutgoingCall[]> {
        if (!isNotebookCell(item.uri)) {
            return next(item, token);
        }
    }

    public provideDocumentSemanticTokens(
        document: TextDocument,
        token: CancellationToken,
        next: DocumentSemanticsTokensSignature,
    ): ProviderResult<SemanticTokens> {
        if (!isNotebookCell(document.uri)) {
            return next(document, token);
        }
    }

    public provideDocumentSemanticTokensEdits(
        document: TextDocument,
        previousResultId: string,
        token: CancellationToken,
        next: DocumentSemanticsTokensEditsSignature,
    ): ProviderResult<SemanticTokensEdits | SemanticTokens> {
        if (!isNotebookCell(document.uri)) {
            return next(document, previousResultId, token);
        }
    }

    public provideDocumentRangeSemanticTokens(
        document: TextDocument,
        range: Range,
        token: CancellationToken,
        next: DocumentRangeSemanticTokensSignature,
    ): ProviderResult<SemanticTokens> {
        if (!isNotebookCell(document.uri)) {
            return next(document, range, token);
        }
    }

    public provideLinkedEditingRange(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        next: ProvideLinkedEditingRangeSignature,
    ): ProviderResult<LinkedEditingRanges> {
        if (!isNotebookCell(document.uri)) {
            return next(document, position, token);
        }
    }
}

export function createHidingMiddleware(): Middleware & Disposable {
    return new HidingMiddlewareAddon();
}
