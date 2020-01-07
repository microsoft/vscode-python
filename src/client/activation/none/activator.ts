// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { injectable } from 'inversify';
import {
    CancellationToken,
    CodeLens,
    CompletionContext,
    CompletionItem,
    CompletionList,
    DocumentSymbol,
    Hover,
    Location,
    LocationLink,
    Position,
    ProviderResult,
    ReferenceContext,
    SignatureHelp,
    SignatureHelpContext,
    SymbolInformation,
    TextDocument,
    WorkspaceEdit
} from 'vscode';
import { Resource } from '../../common/types';
import { PythonInterpreter } from '../../interpreter/contracts';
import { ILanguageServerActivator } from '../types';

/**
 * Provides 'no language server' pseudo-activator.
 *
 * @export
 * @class NoLanguageServerExtensionActivator
 * @implements {ILanguageServerActivator}
 */
@injectable()
export class NoLanguageServerExtensionActivator implements ILanguageServerActivator {
    // tslint:disable-next-line: no-empty
    public async start(_resource: Resource, _interpreter?: PythonInterpreter): Promise<void> {}
    // tslint:disable-next-line: no-empty
    public dispose(): void {}
    // tslint:disable-next-line: no-empty
    public activate(): void {}
    // tslint:disable-next-line: no-empty
    public deactivate(): void {}

    public provideRenameEdits(_document: TextDocument, _position: Position, _newName: string, _token: CancellationToken): ProviderResult<WorkspaceEdit> {
        return null;
    }
    public provideDefinition(_document: TextDocument, _position: Position, _token: CancellationToken): ProviderResult<Location | Location[] | LocationLink[]> {
        return null;
    }
    public provideHover(_document: TextDocument, _position: Position, _token: CancellationToken): ProviderResult<Hover> {
        return null;
    }
    public provideReferences(_document: TextDocument, _position: Position, _context: ReferenceContext, _token: CancellationToken): ProviderResult<Location[]> {
        return null;
    }
    public provideCompletionItems(
        _document: TextDocument,
        _position: Position,
        _token: CancellationToken,
        _context: CompletionContext
    ): ProviderResult<CompletionItem[] | CompletionList> {
        return null;
    }
    public provideCodeLenses(_document: TextDocument, _token: CancellationToken): ProviderResult<CodeLens[]> {
        return null;
    }
    public provideDocumentSymbols(_document: TextDocument, _token: CancellationToken): ProviderResult<SymbolInformation[] | DocumentSymbol[]> {
        return null;
    }
    public provideSignatureHelp(_document: TextDocument, _position: Position, _token: CancellationToken, _context: SignatureHelpContext): ProviderResult<SignatureHelp> {
        return null;
    }
}
