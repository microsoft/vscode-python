// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as path from 'path';
import {
    CancellationToken,
    CodeAction,
    CodeActionContext,
    CodeLens,
    Command,
    CompletionContext,
    CompletionItem,
    Definition,
    DefinitionLink,
    Diagnostic,
    DocumentHighlight,
    DocumentLink,
    DocumentSymbol,
    FormattingOptions,
    Location,
    Position,
    ProviderResult,
    Range,
    SignatureHelp,
    SymbolInformation,
    TextDocument,
    TextEdit,
    Uri,
    WorkspaceEdit
} from 'vscode';
import {
    HandleDiagnosticsSignature,
    Middleware,
    PrepareRenameSignature,
    ProvideCodeActionsSignature,
    ProvideCodeLensesSignature,
    ProvideCompletionItemsSignature,
    ProvideDefinitionSignature,
    ProvideDocumentFormattingEditsSignature,
    ProvideDocumentHighlightsSignature,
    ProvideDocumentLinksSignature,
    ProvideDocumentRangeFormattingEditsSignature,
    ProvideDocumentSymbolsSignature,
    ProvideHoverSignature,
    ProvideOnTypeFormattingEditsSignature,
    ProvideReferencesSignature,
    ProvideRenameEditsSignature,
    ProvideSignatureHelpSignature,
    ProvideWorkspaceSymbolsSignature,
    ResolveCodeLensSignature,
    ResolveCompletionItemSignature,
    ResolveDocumentLinkSignature
} from 'vscode-languageclient';

import { HiddenFilePrefix } from '../common/constants';
import { IPythonExtensionBanner } from '../common/types';

export class LanguageClientMiddleware implements Middleware {
    private connected = false; // Default to not forwarding to VS code.

    public constructor(private readonly surveyBanner: IPythonExtensionBanner) {
        this.handleDiagnostics = this.handleDiagnostics.bind(this); // VS Code calls function without context.
    }

    public connect() {
        this.connected = true;
    }

    public disconnect() {
        this.connected = false;
    }

    public provideCompletionItem(
        document: TextDocument,
        position: Position,
        context: CompletionContext,
        token: CancellationToken,
        next: ProvideCompletionItemsSignature
    ) {
        if (this.connected) {
            this.surveyBanner.showBanner().ignoreErrors();
            return next(document, position, context, token);
        }
    }

    public provideHover(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        next: ProvideHoverSignature
    ) {
        if (this.connected) {
            return next(document, position, token);
        }
    }

    public handleDiagnostics(uri: Uri, diagnostics: Diagnostic[], next: HandleDiagnosticsSignature) {
        if (this.connected) {
            // Skip sending if this is a special file.
            const filePath = uri.fsPath;
            const baseName = filePath ? path.basename(filePath) : undefined;
            if (!baseName || !baseName.startsWith(HiddenFilePrefix)) {
                next(uri, diagnostics);
            }
        }
    }

    public resolveCompletionItem(
        item: CompletionItem,
        token: CancellationToken,
        next: ResolveCompletionItemSignature
    ): ProviderResult<CompletionItem> {
        if (this.connected) {
            return next(item, token);
        }
    }
    public provideSignatureHelp(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        next: ProvideSignatureHelpSignature
    ): ProviderResult<SignatureHelp> {
        if (this.connected) {
            return next(document, position, token);
        }
    }
    public provideDefinition(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        next: ProvideDefinitionSignature
    ): ProviderResult<Definition | DefinitionLink[]> {
        if (this.connected) {
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
        next: ProvideReferencesSignature
    ): ProviderResult<Location[]> {
        if (this.connected) {
            return next(document, position, options, token);
        }
    }
    public provideDocumentHighlights(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        next: ProvideDocumentHighlightsSignature
    ): ProviderResult<DocumentHighlight[]> {
        if (this.connected) {
            return next(document, position, token);
        }
    }
    public provideDocumentSymbols(
        document: TextDocument,
        token: CancellationToken,
        next: ProvideDocumentSymbolsSignature
    ): ProviderResult<SymbolInformation[] | DocumentSymbol[]> {
        if (this.connected) {
            return next(document, token);
        }
    }
    public provideWorkspaceSymbols(
        query: string,
        token: CancellationToken,
        next: ProvideWorkspaceSymbolsSignature
    ): ProviderResult<SymbolInformation[]> {
        if (this.connected) {
            return next(query, token);
        }
    }
    public provideCodeActions(
        document: TextDocument,
        range: Range,
        context: CodeActionContext,
        token: CancellationToken,
        next: ProvideCodeActionsSignature
    ): ProviderResult<(Command | CodeAction)[]> {
        if (this.connected) {
            return next(document, range, context, token);
        }
    }
    public provideCodeLenses(
        document: TextDocument,
        token: CancellationToken,
        next: ProvideCodeLensesSignature
    ): ProviderResult<CodeLens[]> {
        if (this.connected) {
            return next(document, token);
        }
    }
    public resolveCodeLens(
        codeLens: CodeLens,
        token: CancellationToken,
        next: ResolveCodeLensSignature
    ): ProviderResult<CodeLens> {
        if (this.connected) {
            return next(codeLens, token);
        }
    }
    public provideDocumentFormattingEdits(
        document: TextDocument,
        options: FormattingOptions,
        token: CancellationToken,
        next: ProvideDocumentFormattingEditsSignature
    ): ProviderResult<TextEdit[]> {
        if (this.connected) {
            return next(document, options, token);
        }
    }
    public provideDocumentRangeFormattingEdits(
        document: TextDocument,
        range: Range,
        options: FormattingOptions,
        token: CancellationToken,
        next: ProvideDocumentRangeFormattingEditsSignature
    ): ProviderResult<TextEdit[]> {
        if (this.connected) {
            return next(document, range, options, token);
        }
    }
    public provideOnTypeFormattingEdits(
        document: TextDocument,
        position: Position,
        ch: string,
        options: FormattingOptions,
        token: CancellationToken,
        next: ProvideOnTypeFormattingEditsSignature
    ): ProviderResult<TextEdit[]> {
        if (this.connected) {
            return next(document, position, ch, options, token);
        }
    }
    public provideRenameEdits(
        document: TextDocument,
        position: Position,
        newName: string,
        token: CancellationToken,
        next: ProvideRenameEditsSignature
    ): ProviderResult<WorkspaceEdit> {
        if (this.connected) {
            return next(document, position, newName, token);
        }
    }
    public prepareRename(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        next: PrepareRenameSignature
    ): ProviderResult<
        | Range
        | {
              range: Range;
              placeholder: string;
          }
    > {
        if (this.connected) {
            return next(document, position, token);
        }
    }
    public provideDocumentLinks(
        document: TextDocument,
        token: CancellationToken,
        next: ProvideDocumentLinksSignature
    ): ProviderResult<DocumentLink[]> {
        if (this.connected) {
            return next(document, token);
        }
    }
    public resolveDocumentLink(
        link: DocumentLink,
        token: CancellationToken,
        next: ResolveDocumentLinkSignature
    ): ProviderResult<DocumentLink> {
        if (this.connected) {
            return next(link, token);
        }
    }
}
