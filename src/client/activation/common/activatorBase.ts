// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
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
    TextDocumentContentChangeEvent,
    WorkspaceEdit
} from 'vscode';
import * as vscodeLanguageClient from 'vscode-languageclient';

import { injectable } from 'inversify';
import { IWorkspaceService } from '../../common/application/types';
import { traceDecorators } from '../../common/logger';
import { IFileSystem } from '../../common/platform/types';
import { IConfigurationService, Resource } from '../../common/types';
import { EXTENSION_ROOT_DIR } from '../../constants';
import { PythonInterpreter } from '../../interpreter/contracts';
import { ILanguageServerActivator, ILanguageServerDownloader, ILanguageServerFolderService, ILanguageServerManager } from '../types';

/**
 * Starts the language server managers per workspaces (currently one for first workspace).
 *
 * @export
 * @class LanguageServerActivatorBase
 * @implements {ILanguageServerActivator}
 */
@injectable()
export abstract class LanguageServerActivatorBase implements ILanguageServerActivator {
    protected resource?: Resource;
    constructor(
        protected readonly manager: ILanguageServerManager,
        private readonly workspace: IWorkspaceService,
        protected readonly fs: IFileSystem,
        protected readonly lsDownloader: ILanguageServerDownloader,
        protected readonly languageServerFolderService: ILanguageServerFolderService,
        protected readonly configurationService: IConfigurationService
    ) {}

    @traceDecorators.error('Failed to activate language server')
    public async start(resource: Resource, interpreter?: PythonInterpreter): Promise<void> {
        if (!resource) {
            resource = this.workspace.hasWorkspaceFolders ? this.workspace.workspaceFolders![0].uri : undefined;
        }
        this.resource = resource;
        await this.ensureLanguageServerIsAvailable(resource);
        await this.manager.start(resource, interpreter);
    }

    public dispose(): void {
        this.manager.dispose();
    }

    public abstract async ensureLanguageServerIsAvailable(resource: Resource): Promise<void>;

    public activate(): void {
        this.manager.connect();
    }

    public deactivate(): void {
        this.manager.disconnect();
    }

    public handleOpen(document: TextDocument): void {
        const languageClient = this.getLanguageClient();
        if (languageClient) {
            languageClient.sendNotification(vscodeLanguageClient.DidOpenTextDocumentNotification.type, languageClient.code2ProtocolConverter.asOpenTextDocumentParams(document));
        }
    }

    public handleChanges(document: TextDocument, changes: TextDocumentContentChangeEvent[]): void {
        const languageClient = this.getLanguageClient();
        if (languageClient) {
            languageClient.sendNotification(
                vscodeLanguageClient.DidChangeTextDocumentNotification.type,
                languageClient.code2ProtocolConverter.asChangeTextDocumentParams({ document, contentChanges: changes })
            );
        }
    }

    public provideRenameEdits(document: TextDocument, position: Position, newName: string, token: CancellationToken): ProviderResult<WorkspaceEdit> {
        return this.handleProvideRenameEdits(document, position, newName, token);
    }

    public provideDefinition(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Location | Location[] | LocationLink[]> {
        return this.handleProvideDefinition(document, position, token);
    }

    public provideHover(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Hover> {
        return this.handleProvideHover(document, position, token);
    }

    public provideReferences(document: TextDocument, position: Position, context: ReferenceContext, token: CancellationToken): ProviderResult<Location[]> {
        return this.handleProvideReferences(document, position, context, token);
    }

    public provideCompletionItems(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        context: CompletionContext
    ): ProviderResult<CompletionItem[] | CompletionList> {
        return this.handleProvideCompletionItems(document, position, token, context);
    }

    public provideCodeLenses(document: TextDocument, token: CancellationToken): ProviderResult<CodeLens[]> {
        return this.handleProvideCodeLenses(document, token);
    }

    public provideDocumentSymbols(document: TextDocument, token: CancellationToken): ProviderResult<SymbolInformation[] | DocumentSymbol[]> {
        return this.handleProvideDocumentSymbols(document, token);
    }

    public provideSignatureHelp(document: TextDocument, position: Position, token: CancellationToken, context: SignatureHelpContext): ProviderResult<SignatureHelp> {
        return this.handleProvideSignatureHelp(document, position, token, context);
    }

    protected async ensureLanguageServerFileIsAvailable(resource: Resource, fileName: string): Promise<string | undefined> {
        const settings = this.configurationService.getSettings(resource);
        if (!settings.downloadLanguageServer) {
            return;
        }
        const languageServerFolder = await this.languageServerFolderService.getLanguageServerFolderName(resource);
        const languageServerFolderPath = path.join(EXTENSION_ROOT_DIR, languageServerFolder);
        const mscorlib = path.join(languageServerFolderPath, fileName);
        if (!(await this.fs.fileExists(mscorlib))) {
            await this.lsDownloader.downloadLanguageServer(languageServerFolderPath, resource);
        }
        return languageServerFolderPath;
    }

    private getLanguageClient(): vscodeLanguageClient.LanguageClient | undefined {
        const proxy = this.manager.languageProxy;
        if (proxy) {
            return proxy.languageClient;
        }
    }

    private async handleProvideRenameEdits(document: TextDocument, position: Position, newName: string, token: CancellationToken): Promise<WorkspaceEdit | undefined> {
        const languageClient = this.getLanguageClient();
        if (languageClient) {
            const args: vscodeLanguageClient.RenameParams = {
                textDocument: languageClient.code2ProtocolConverter.asTextDocumentIdentifier(document),
                position: languageClient.code2ProtocolConverter.asPosition(position),
                newName
            };
            const result = await languageClient.sendRequest(vscodeLanguageClient.RenameRequest.type, args, token);
            if (result) {
                return languageClient.protocol2CodeConverter.asWorkspaceEdit(result);
            }
        }
    }

    private async handleProvideDefinition(document: TextDocument, position: Position, token: CancellationToken): Promise<Location | Location[] | LocationLink[] | undefined> {
        const languageClient = this.getLanguageClient();
        if (languageClient) {
            const args: vscodeLanguageClient.TextDocumentPositionParams = {
                textDocument: languageClient.code2ProtocolConverter.asTextDocumentIdentifier(document),
                position: languageClient.code2ProtocolConverter.asPosition(position)
            };
            const result = await languageClient.sendRequest(vscodeLanguageClient.DefinitionRequest.type, args, token);
            if (result) {
                return languageClient.protocol2CodeConverter.asDefinitionResult(result);
            }
        }
    }

    private async handleProvideHover(document: TextDocument, position: Position, token: CancellationToken): Promise<Hover | undefined> {
        const languageClient = this.getLanguageClient();
        if (languageClient) {
            const args: vscodeLanguageClient.TextDocumentPositionParams = {
                textDocument: languageClient.code2ProtocolConverter.asTextDocumentIdentifier(document),
                position: languageClient.code2ProtocolConverter.asPosition(position)
            };
            const result = await languageClient.sendRequest(vscodeLanguageClient.HoverRequest.type, args, token);
            if (result) {
                return languageClient.protocol2CodeConverter.asHover(result);
            }
        }
    }

    private async handleProvideReferences(document: TextDocument, position: Position, context: ReferenceContext, token: CancellationToken): Promise<Location[] | undefined> {
        const languageClient = this.getLanguageClient();
        if (languageClient) {
            const args: vscodeLanguageClient.ReferenceParams = {
                textDocument: languageClient.code2ProtocolConverter.asTextDocumentIdentifier(document),
                position: languageClient.code2ProtocolConverter.asPosition(position),
                context
            };
            const result = await languageClient.sendRequest(vscodeLanguageClient.ReferencesRequest.type, args, token);
            if (result) {
                // Remove undefined part.
                return result.map(l => {
                    const r = languageClient!.protocol2CodeConverter.asLocation(l);
                    return r!;
                });
            }
        }
    }

    private async handleProvideCodeLenses(document: TextDocument, token: CancellationToken): Promise<CodeLens[] | undefined> {
        const languageClient = this.getLanguageClient();
        if (languageClient) {
            const args: vscodeLanguageClient.CodeLensParams = {
                textDocument: languageClient.code2ProtocolConverter.asTextDocumentIdentifier(document)
            };
            const result = await languageClient.sendRequest(vscodeLanguageClient.CodeLensRequest.type, args, token);
            if (result) {
                return languageClient.protocol2CodeConverter.asCodeLenses(result);
            }
        }
    }

    private async handleProvideCompletionItems(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        context: CompletionContext
    ): Promise<CompletionItem[] | CompletionList | undefined> {
        const languageClient = this.getLanguageClient();
        if (languageClient) {
            const args = languageClient.code2ProtocolConverter.asCompletionParams(document, position, context);
            const result = await languageClient.sendRequest(vscodeLanguageClient.CompletionRequest.type, args, token);
            if (result) {
                return languageClient.protocol2CodeConverter.asCompletionResult(result);
            }
        }
    }

    private async handleProvideDocumentSymbols(document: TextDocument, token: CancellationToken): Promise<SymbolInformation[] | DocumentSymbol[] | undefined> {
        const languageClient = this.getLanguageClient();
        if (languageClient) {
            const args: vscodeLanguageClient.DocumentSymbolParams = {
                textDocument: languageClient.code2ProtocolConverter.asTextDocumentIdentifier(document)
            };
            const result = await languageClient.sendRequest(vscodeLanguageClient.DocumentSymbolRequest.type, args, token);
            if (result && result.length) {
                // tslint:disable-next-line: no-any
                if ((result[0] as any).range) {
                    // Document symbols
                    const docSymbols = result as vscodeLanguageClient.DocumentSymbol[];
                    return languageClient.protocol2CodeConverter.asDocumentSymbols(docSymbols);
                } else {
                    // Document symbols
                    const symbols = result as vscodeLanguageClient.SymbolInformation[];
                    return languageClient.protocol2CodeConverter.asSymbolInformations(symbols);
                }
            }
        }
    }

    private async handleProvideSignatureHelp(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        _context: SignatureHelpContext
    ): Promise<SignatureHelp | undefined> {
        const languageClient = this.getLanguageClient();
        if (languageClient) {
            const args: vscodeLanguageClient.TextDocumentPositionParams = {
                textDocument: languageClient.code2ProtocolConverter.asTextDocumentIdentifier(document),
                position: languageClient.code2ProtocolConverter.asPosition(position)
            };
            const result = await languageClient.sendRequest(vscodeLanguageClient.SignatureHelpRequest.type, args, token);
            if (result) {
                return languageClient.protocol2CodeConverter.asSignatureHelp(result);
            }
        }
    }
}
