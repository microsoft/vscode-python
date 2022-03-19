// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

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
    WorkspaceEdit,
} from 'vscode';
import * as vscodeLanguageClient from 'vscode-languageclient/node';
import { ILanguageServer, ILanguageServerConnection, ILanguageServerProxy } from '../activation/types';
import { ILanguageServerCapabilities } from './types';

/*
 * The Language Server Capabilities class implements the ILanguageServer interface to provide support for the existing Jupyter integration.
 */
export class LanguageServerCapabilities implements ILanguageServerCapabilities {
    serverProxy: ILanguageServerProxy | undefined;

    public dispose(): void {
        // Nothing to do here.
    }

    get(): Promise<ILanguageServer> {
        return Promise.resolve(this);
    }

    public get connection(): ILanguageServerConnection | undefined {
        const languageClient = this.getLanguageClient();
        if (languageClient) {
            // Return an object that looks like a connection
            return {
                sendNotification: languageClient.sendNotification.bind(languageClient),
                sendRequest: languageClient.sendRequest.bind(languageClient),
                sendProgress: languageClient.sendProgress.bind(languageClient),
                onRequest: languageClient.onRequest.bind(languageClient),
                onNotification: languageClient.onNotification.bind(languageClient),
                onProgress: languageClient.onProgress.bind(languageClient),
            };
        }

        return undefined;
    }

    public get capabilities(): vscodeLanguageClient.ServerCapabilities | undefined {
        const languageClient = this.getLanguageClient();
        if (languageClient) {
            return languageClient.initializeResult?.capabilities;
        }

        return undefined;
    }

    public provideRenameEdits(
        document: TextDocument,
        position: Position,
        newName: string,
        token: CancellationToken,
    ): ProviderResult<WorkspaceEdit> {
        return this.handleProvideRenameEdits(document, position, newName, token);
    }

    public provideDefinition(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
    ): ProviderResult<Location | Location[] | LocationLink[]> {
        return this.handleProvideDefinition(document, position, token);
    }

    public provideHover(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Hover> {
        return this.handleProvideHover(document, position, token);
    }

    public provideReferences(
        document: TextDocument,
        position: Position,
        context: ReferenceContext,
        token: CancellationToken,
    ): ProviderResult<Location[]> {
        return this.handleProvideReferences(document, position, context, token);
    }

    public provideCompletionItems(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        context: CompletionContext,
    ): ProviderResult<CompletionItem[] | CompletionList> {
        return this.handleProvideCompletionItems(document, position, token, context);
    }

    public provideCodeLenses(document: TextDocument, token: CancellationToken): ProviderResult<CodeLens[]> {
        return this.handleProvideCodeLenses(document, token);
    }

    public provideDocumentSymbols(
        document: TextDocument,
        token: CancellationToken,
    ): ProviderResult<SymbolInformation[] | DocumentSymbol[]> {
        return this.handleProvideDocumentSymbols(document, token);
    }

    public provideSignatureHelp(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        context: SignatureHelpContext,
    ): ProviderResult<SignatureHelp> {
        return this.handleProvideSignatureHelp(document, position, token, context);
    }

    protected getLanguageClient(): vscodeLanguageClient.LanguageClient | undefined {
        return this.serverProxy?.languageClient;
    }

    private async handleProvideRenameEdits(
        document: TextDocument,
        position: Position,
        newName: string,
        token: CancellationToken,
    ): Promise<WorkspaceEdit | undefined> {
        const languageClient = this.getLanguageClient();
        if (languageClient) {
            const args: vscodeLanguageClient.RenameParams = {
                textDocument: languageClient.code2ProtocolConverter.asTextDocumentIdentifier(document),
                position: languageClient.code2ProtocolConverter.asPosition(position),
                newName,
            };
            const result = await languageClient.sendRequest(vscodeLanguageClient.RenameRequest.type, args, token);
            if (result) {
                return languageClient.protocol2CodeConverter.asWorkspaceEdit(result);
            }
        }

        return undefined;
    }

    private async handleProvideDefinition(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
    ): Promise<Location | Location[] | LocationLink[] | undefined> {
        const languageClient = this.getLanguageClient();
        if (languageClient) {
            const args: vscodeLanguageClient.TextDocumentPositionParams = {
                textDocument: languageClient.code2ProtocolConverter.asTextDocumentIdentifier(document),
                position: languageClient.code2ProtocolConverter.asPosition(position),
            };
            const result = await languageClient.sendRequest(vscodeLanguageClient.DefinitionRequest.type, args, token);
            if (result) {
                return languageClient.protocol2CodeConverter.asDefinitionResult(result);
            }
        }

        return undefined;
    }

    private async handleProvideHover(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
    ): Promise<Hover | undefined> {
        const languageClient = this.getLanguageClient();
        if (languageClient) {
            const args: vscodeLanguageClient.TextDocumentPositionParams = {
                textDocument: languageClient.code2ProtocolConverter.asTextDocumentIdentifier(document),
                position: languageClient.code2ProtocolConverter.asPosition(position),
            };
            const result = await languageClient.sendRequest(vscodeLanguageClient.HoverRequest.type, args, token);
            if (result) {
                return languageClient.protocol2CodeConverter.asHover(result);
            }
        }

        return undefined;
    }

    private async handleProvideReferences(
        document: TextDocument,
        position: Position,
        context: ReferenceContext,
        token: CancellationToken,
    ): Promise<Location[] | undefined> {
        const languageClient = this.getLanguageClient();
        if (languageClient) {
            const args: vscodeLanguageClient.ReferenceParams = {
                textDocument: languageClient.code2ProtocolConverter.asTextDocumentIdentifier(document),
                position: languageClient.code2ProtocolConverter.asPosition(position),
                context,
            };
            const result = await languageClient.sendRequest(vscodeLanguageClient.ReferencesRequest.type, args, token);
            if (result) {
                // Remove undefined part.
                return result.map((l) => {
                    const r = languageClient!.protocol2CodeConverter.asLocation(l);
                    return r!;
                });
            }
        }

        return undefined;
    }

    private async handleProvideCodeLenses(
        document: TextDocument,
        token: CancellationToken,
    ): Promise<CodeLens[] | undefined> {
        const languageClient = this.getLanguageClient();
        if (languageClient) {
            const args: vscodeLanguageClient.CodeLensParams = {
                textDocument: languageClient.code2ProtocolConverter.asTextDocumentIdentifier(document),
            };
            const result = await languageClient.sendRequest(vscodeLanguageClient.CodeLensRequest.type, args, token);
            if (result) {
                return languageClient.protocol2CodeConverter.asCodeLenses(result);
            }
        }

        return undefined;
    }

    private async handleProvideCompletionItems(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        context: CompletionContext,
    ): Promise<CompletionItem[] | CompletionList | undefined> {
        const languageClient = this.getLanguageClient();
        if (languageClient) {
            const args = languageClient.code2ProtocolConverter.asCompletionParams(document, position, context);
            const result = await languageClient.sendRequest(vscodeLanguageClient.CompletionRequest.type, args, token);
            if (result) {
                return languageClient.protocol2CodeConverter.asCompletionResult(result);
            }
        }

        return undefined;
    }

    private async handleProvideDocumentSymbols(
        document: TextDocument,
        token: CancellationToken,
    ): Promise<SymbolInformation[] | DocumentSymbol[] | undefined> {
        const languageClient = this.getLanguageClient();
        if (languageClient) {
            const args: vscodeLanguageClient.DocumentSymbolParams = {
                textDocument: languageClient.code2ProtocolConverter.asTextDocumentIdentifier(document),
            };
            const result = await languageClient.sendRequest(
                vscodeLanguageClient.DocumentSymbolRequest.type,
                args,
                token,
            );
            if (result && result.length) {
                if ((result[0] as DocumentSymbol).range) {
                    // Document symbols
                    const docSymbols = result as vscodeLanguageClient.DocumentSymbol[];
                    return languageClient.protocol2CodeConverter.asDocumentSymbols(docSymbols);
                }
                // Document symbols
                const symbols = result as vscodeLanguageClient.SymbolInformation[];
                return languageClient.protocol2CodeConverter.asSymbolInformations(symbols);
            }
        }

        return undefined;
    }

    private async handleProvideSignatureHelp(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        _context: SignatureHelpContext,
    ): Promise<SignatureHelp | undefined> {
        const languageClient = this.getLanguageClient();
        if (languageClient) {
            const args: vscodeLanguageClient.TextDocumentPositionParams = {
                textDocument: languageClient.code2ProtocolConverter.asTextDocumentIdentifier(document),
                position: languageClient.code2ProtocolConverter.asPosition(position),
            };
            const result = await languageClient.sendRequest(
                vscodeLanguageClient.SignatureHelpRequest.type,
                args,
                token,
            );
            if (result) {
                return languageClient.protocol2CodeConverter.asSignatureHelp(result);
            }
        }

        return undefined;
    }
}
