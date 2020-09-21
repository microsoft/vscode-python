// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable } from 'inversify';
import {
    CancellationToken,
    CompletionContext,
    Event,
    EventEmitter,
    Position,
    ReferenceContext,
    SignatureHelpContext,
    TextDocument
} from 'vscode';
// tslint:disable-next-line: import-name
import { IWorkspaceService } from '../../common/application/types';
import { JediLSP } from '../../common/experiments/groups';
import { IFileSystem } from '../../common/platform/types';
import { IConfigurationService, IExperimentService, Resource } from '../../common/types';
import { IServiceManager } from '../../ioc/types';
import { PythonEnvironment } from '../../pythonEnvironments/info';
import { JediExtensionActivator } from '../jedi';
import { ILanguageServerActivator, ILanguageServerManager } from '../types';
import { JediLanguageServerActivator } from './activator';

/**
 * Starts jedi language server manager.
 *
 * @export
 * @class JediLanguageServerActivator
 * @implements {ILanguageServerActivator}
 * @extends {LanguageServerActivatorBase}
 */
@injectable()
export class MultiplexingJediLanguageServerActivator implements ILanguageServerActivator {
    private realLanguageServerPromise: Promise<ILanguageServerActivator>;
    private realLanguageServer: ILanguageServerActivator | undefined;
    private onDidChangeCodeLensesEmitter = new EventEmitter<void>();

    constructor(
        @inject(IServiceManager) private readonly manager: IServiceManager,
        @inject(IExperimentService) experimentService: IExperimentService
    ) {
        // Check experiment service to see if using new Jedi LSP protocol
        this.realLanguageServerPromise = experimentService.inExperiment(JediLSP.experiment).then((inExperiment) => {
            this.realLanguageServer = !inExperiment
                ? // Pick how to launch jedi based on if in the experiment or not.
                  new JediExtensionActivator(this.manager)
                : new JediLanguageServerActivator(
                      this.manager.get<ILanguageServerManager>(ILanguageServerManager),
                      this.manager.get<IWorkspaceService>(IWorkspaceService),
                      this.manager.get<IFileSystem>(IFileSystem),
                      this.manager.get<IConfigurationService>(IConfigurationService)
                  );
            return this.realLanguageServer;
        });
    }
    public async start(resource: Resource, interpreter: PythonEnvironment | undefined): Promise<void> {
        const realServer = await this.realLanguageServerPromise;
        return realServer.start(resource, interpreter);
    }
    public activate(): void {
        if (this.realLanguageServer) {
            this.realLanguageServer.activate();
        }
    }
    public deactivate(): void {
        if (this.realLanguageServer) {
            this.realLanguageServer.deactivate();
        }
    }
    public get onDidChangeCodeLenses(): Event<void> {
        return this.onDidChangeCodeLensesEmitter.event;
    }

    public get connection() {
        if (this.realLanguageServer) {
            return this.realLanguageServer.connection;
        }
    }

    public get capabilities() {
        if (this.realLanguageServer) {
            return this.realLanguageServer.capabilities;
        }
    }

    public async provideRenameEdits(
        document: TextDocument,
        position: Position,
        newName: string,
        token: CancellationToken
    ) {
        const server = await this.realLanguageServerPromise;
        return server.provideRenameEdits(document, position, newName, token);
    }
    public async provideDefinition(document: TextDocument, position: Position, token: CancellationToken) {
        const server = await this.realLanguageServerPromise;
        return server.provideDefinition(document, position, token);
    }
    public async provideHover(document: TextDocument, position: Position, token: CancellationToken) {
        const server = await this.realLanguageServerPromise;
        return server.provideHover(document, position, token);
    }
    public async provideReferences(
        document: TextDocument,
        position: Position,
        context: ReferenceContext,
        token: CancellationToken
    ) {
        const server = await this.realLanguageServerPromise;
        return server.provideReferences(document, position, context, token);
    }
    public async provideCompletionItems(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        context: CompletionContext
    ) {
        const server = await this.realLanguageServerPromise;
        return server.provideCompletionItems(document, position, token, context);
    }
    public async provideCodeLenses(document: TextDocument, token: CancellationToken) {
        const server = await this.realLanguageServerPromise;
        return server.provideCodeLenses(document, token);
    }
    public async provideDocumentSymbols(document: TextDocument, token: CancellationToken) {
        const server = await this.realLanguageServerPromise;
        return server.provideDocumentSymbols(document, token);
    }
    public async provideSignatureHelp(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        context: SignatureHelpContext
    ) {
        const server = await this.realLanguageServerPromise;
        return server.provideSignatureHelp(document, position, token, context);
    }
    public dispose(): void {
        if (this.realLanguageServer) {
            this.realLanguageServer.dispose();
            this.realLanguageServer = undefined;
        }
    }
}
