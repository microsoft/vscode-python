import {
    CancellationToken,
    CompletionContext,
    CompletionItem,
    Disposable,
    Position,
    SignatureHelpContext,
    TextDocument,
    TextDocumentContentChangeEvent
} from 'vscode';
import * as c2p from 'vscode-languageclient/lib/common/codeConverter';
import * as p2c from 'vscode-languageclient/lib/common/protocolConverter';
import * as vscodeLanguageClient from 'vscode-languageclient/node';
import * as lsp from 'vscode-languageserver-protocol';
import { ILanguageServerConnection } from '../../../activation/types';
import { Resource } from '../../../common/types';
import { createDeferred } from '../../../common/utils/async';
import { PythonEnvironment } from '../../../pythonEnvironments/info';
import { ILanguageServer, JupyterExtensionIntegration } from '../../api/jupyterIntegration';

/**
 * Class that wraps a language server for use by webview based notebooks
 */
export class NotebookLanguageServer implements Disposable {
    private code2ProtocolConverter = c2p.createConverter();
    private protocol2CodeConverter = p2c.createConverter();
    private connection: ILanguageServerConnection;
    private capabilities: lsp.ServerCapabilities;
    private disposeConnection: () => void;
    private constructor(ls: ILanguageServer) {
        this.connection = ls.connection;
        this.capabilities = ls.capabilities;
        this.disposeConnection = ls.dispose.bind(ls);
    }

    public static async create(
        jupyterApiProvider: JupyterExtensionIntegration,
        resource: Resource,
        interpreter: PythonEnvironment | undefined
    ): Promise<NotebookLanguageServer | undefined> {
        // Create a server wrapper if we can get a connection to a language server
        const deferred = createDeferred<NotebookLanguageServer | undefined>();
        jupyterApiProvider.registerApi({
            registerPythonApi: (api) => {
                api.getLanguageServer(interpreter ? interpreter : resource)
                    .then((c) => {
                        if (c) {
                            deferred.resolve(new NotebookLanguageServer(c));
                        } else {
                            deferred.resolve(undefined);
                        }
                    })
                    .catch(deferred.reject);
            }
        });
        return deferred.promise;
    }

    public dispose() {
        this.disposeConnection();
    }

    public sendOpen(document: TextDocument) {
        this.connection.sendNotification(
            vscodeLanguageClient.DidOpenTextDocumentNotification.type,
            this.code2ProtocolConverter.asOpenTextDocumentParams(document)
        );
    }

    public sendChanges(document: TextDocument, changes: TextDocumentContentChangeEvent[]) {
        // If the language client doesn't support incremental, just send the whole document
        if (this.textDocumentSyncKind === vscodeLanguageClient.TextDocumentSyncKind.Full) {
            this.connection.sendNotification(
                vscodeLanguageClient.DidChangeTextDocumentNotification.type,
                this.code2ProtocolConverter.asChangeTextDocumentParams(document)
            );
        } else {
            this.connection.sendNotification(
                vscodeLanguageClient.DidChangeTextDocumentNotification.type,
                this.code2ProtocolConverter.asChangeTextDocumentParams({
                    document,
                    contentChanges: changes
                })
            );
        }
    }

    public async provideCompletionItems(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        context: CompletionContext
    ) {
        const args = this.code2ProtocolConverter.asCompletionParams(document, position, context);
        const result = await this.connection.sendRequest(vscodeLanguageClient.CompletionRequest.type, args, token);
        if (result) {
            return this.protocol2CodeConverter.asCompletionResult(result);
        }
    }

    public async provideSignatureHelp(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        _context: SignatureHelpContext
    ) {
        const args: vscodeLanguageClient.TextDocumentPositionParams = {
            textDocument: this.code2ProtocolConverter.asTextDocumentIdentifier(document),
            position: this.code2ProtocolConverter.asPosition(position)
        };
        const result = await this.connection.sendRequest(vscodeLanguageClient.SignatureHelpRequest.type, args, token);
        if (result) {
            return this.protocol2CodeConverter.asSignatureHelp(result);
        }
    }

    public async provideHover(document: TextDocument, position: Position, token: CancellationToken) {
        const args: vscodeLanguageClient.TextDocumentPositionParams = {
            textDocument: this.code2ProtocolConverter.asTextDocumentIdentifier(document),
            position: this.code2ProtocolConverter.asPosition(position)
        };
        const result = await this.connection.sendRequest(vscodeLanguageClient.HoverRequest.type, args, token);
        if (result) {
            return this.protocol2CodeConverter.asHover(result);
        }
    }

    public async resolveCompletionItem(item: CompletionItem, token: CancellationToken) {
        const result = await this.connection.sendRequest(
            vscodeLanguageClient.CompletionResolveRequest.type,
            this.code2ProtocolConverter.asCompletionItem(item),
            token
        );
        if (result) {
            return this.protocol2CodeConverter.asCompletionItem(result);
        }
    }

    private get textDocumentSyncKind(): vscodeLanguageClient.TextDocumentSyncKind {
        if (this.capabilities.textDocumentSync) {
            const syncOptions = this.capabilities.textDocumentSync;
            const syncKind =
                syncOptions !== undefined && syncOptions.hasOwnProperty('change')
                    ? (syncOptions as vscodeLanguageClient.TextDocumentSyncOptions).change
                    : syncOptions;
            if (syncKind !== undefined) {
                return syncKind as vscodeLanguageClient.TextDocumentSyncKind;
            }
        }

        // Default is full if not provided
        return vscodeLanguageClient.TextDocumentSyncKind.Full;
    }
}
