// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable } from 'inversify';
import {
    CancellationToken,
    CodeLens,
    commands,
    CompletionContext,
    CompletionItem,
    CompletionList,
    DocumentFilter,
    DocumentSymbol,
    Event,
    Hover,
    languages,
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

import { PYTHON } from '../common/constants';
import { traceError } from '../common/logger';
import { IConfigurationService, IDisposable, IExtensionContext, Resource } from '../common/types';
import { IShebangCodeLensProvider } from '../interpreter/contracts';
import { IServiceContainer, IServiceManager } from '../ioc/types';
import { JediFactory } from '../languageServices/jediProxyFactory';
import { PythonCompletionItemProvider } from '../providers/completionProvider';
import { PythonDefinitionProvider } from '../providers/definitionProvider';
import { PythonHoverProvider } from '../providers/hoverProvider';
import { PythonObjectDefinitionProvider } from '../providers/objectDefinitionProvider';
import { PythonReferenceProvider } from '../providers/referenceProvider';
import { PythonRenameProvider } from '../providers/renameProvider';
import { PythonSignatureProvider } from '../providers/signatureProvider';
import { JediSymbolProvider } from '../providers/symbolProvider';
import { PythonEnvironment } from '../pythonEnvironments/info';
import { ITestingService } from '../testing/types';
import { BlockFormatProviders } from '../typeFormatters/blockFormatProvider';
import { OnTypeFormattingDispatcher } from '../typeFormatters/dispatcher';
import { OnEnterFormatter } from '../typeFormatters/onEnterFormatter';
import { WorkspaceSymbols } from '../workspaceSymbols/main';
import { ILanguageServerActivator } from './types';

@injectable()
export class JediExtensionActivator implements ILanguageServerActivator {
    private static workspaceSymbols: WorkspaceSymbols | undefined;
    private readonly context: IExtensionContext;
    private jediFactory?: JediFactory;
    private readonly documentSelector: DocumentFilter[];
    private renameProvider: PythonRenameProvider | undefined;
    private hoverProvider: PythonHoverProvider | undefined;
    private definitionProvider: PythonDefinitionProvider | undefined;
    private referenceProvider: PythonReferenceProvider | undefined;
    private completionProvider: PythonCompletionItemProvider | undefined;
    private codeLensProvider: IShebangCodeLensProvider | undefined;
    private symbolProvider: JediSymbolProvider | undefined;
    private signatureProvider: PythonSignatureProvider | undefined;
    private registrations: IDisposable[] = [];
    private objectDefinitionProvider: PythonObjectDefinitionProvider | undefined;

    constructor(@inject(IServiceManager) private serviceManager: IServiceManager) {
        this.context = this.serviceManager.get<IExtensionContext>(IExtensionContext);
        this.documentSelector = PYTHON;
    }

    public async start(_resource: Resource, interpreter: PythonEnvironment | undefined): Promise<void> {
        if (this.jediFactory) {
            throw new Error('Jedi already started');
        }
        const context = this.context;
        const jediFactory = (this.jediFactory = new JediFactory(interpreter, this.serviceManager));
        context.subscriptions.push(jediFactory);
        const serviceContainer = this.serviceManager.get<IServiceContainer>(IServiceContainer);

        this.renameProvider = new PythonRenameProvider(this.serviceManager);
        this.definitionProvider = new PythonDefinitionProvider(jediFactory);
        this.hoverProvider = new PythonHoverProvider(jediFactory);
        this.referenceProvider = new PythonReferenceProvider(jediFactory);
        this.completionProvider = new PythonCompletionItemProvider(jediFactory, this.serviceManager);
        this.codeLensProvider = this.serviceManager.get<IShebangCodeLensProvider>(IShebangCodeLensProvider);
        this.objectDefinitionProvider = new PythonObjectDefinitionProvider(jediFactory);
        this.symbolProvider = new JediSymbolProvider(serviceContainer, jediFactory);
        this.signatureProvider = new PythonSignatureProvider(jediFactory);

        if (!JediExtensionActivator.workspaceSymbols) {
            // Workspace symbols is static because it doesn't rely on the jediFactory.
            JediExtensionActivator.workspaceSymbols = new WorkspaceSymbols(serviceContainer);
            context.subscriptions.push(JediExtensionActivator.workspaceSymbols);
        }

        const testManagementService = this.serviceManager.get<ITestingService>(ITestingService);
        testManagementService
            .activate(this.symbolProvider)
            .catch((ex) => traceError('Failed to activate Unit Tests', ex));
    }

    public deactivate() {
        this.registrations.forEach((r) => r.dispose());
        this.registrations = [];
    }

    public activate() {
        if (
            this.registrations.length === 0 &&
            this.renameProvider &&
            this.definitionProvider &&
            this.hoverProvider &&
            this.referenceProvider &&
            this.completionProvider &&
            this.codeLensProvider &&
            this.symbolProvider &&
            this.signatureProvider
        ) {
            // Make sure commands are in the registration list that gets disposed when the language server is disconnected from the
            // IDE.
            this.registrations.push(
                commands.registerCommand('python.goToPythonObject', () =>
                    this.objectDefinitionProvider!.goToObjectDefinition(),
                ),
            );
            this.registrations.push(languages.registerRenameProvider(this.documentSelector, this.renameProvider));
            this.registrations.push(
                languages.registerDefinitionProvider(this.documentSelector, this.definitionProvider),
            );
            this.registrations.push(languages.registerHoverProvider(this.documentSelector, this.hoverProvider));
            this.registrations.push(languages.registerReferenceProvider(this.documentSelector, this.referenceProvider));
            this.registrations.push(
                languages.registerCompletionItemProvider(this.documentSelector, this.completionProvider, '.'),
            );
            this.registrations.push(languages.registerCodeLensProvider(this.documentSelector, this.codeLensProvider));
            const onTypeDispatcher = new OnTypeFormattingDispatcher({
                '\n': new OnEnterFormatter(),
                ':': new BlockFormatProviders(),
            });
            const onTypeTriggers = onTypeDispatcher.getTriggerCharacters();
            if (onTypeTriggers) {
                this.registrations.push(
                    languages.registerOnTypeFormattingEditProvider(
                        PYTHON,
                        onTypeDispatcher,
                        onTypeTriggers.first,
                        ...onTypeTriggers.more,
                    ),
                );
            }
            this.registrations.push(
                languages.registerDocumentSymbolProvider(this.documentSelector, this.symbolProvider),
            );
            const pythonSettings = this.serviceManager.get<IConfigurationService>(IConfigurationService).getSettings();
            if (pythonSettings.devOptions.indexOf('DISABLE_SIGNATURE') === -1) {
                this.registrations.push(
                    languages.registerSignatureHelpProvider(this.documentSelector, this.signatureProvider, '(', ','),
                );
            }
        }
    }

    public provideRenameEdits(
        document: TextDocument,
        position: Position,
        newName: string,
        token: CancellationToken,
    ): ProviderResult<WorkspaceEdit> {
        if (this.renameProvider) {
            return this.renameProvider.provideRenameEdits(document, position, newName, token);
        }
    }
    public provideDefinition(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
    ): ProviderResult<Location | Location[] | LocationLink[]> {
        if (this.definitionProvider) {
            return this.definitionProvider.provideDefinition(document, position, token);
        }
    }
    public provideHover(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Hover> {
        if (this.hoverProvider) {
            return this.hoverProvider.provideHover(document, position, token);
        }
    }
    public provideReferences(
        document: TextDocument,
        position: Position,
        context: ReferenceContext,
        token: CancellationToken,
    ): ProviderResult<Location[]> {
        if (this.referenceProvider) {
            return this.referenceProvider.provideReferences(document, position, context, token);
        }
    }
    public provideCompletionItems(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        _context: CompletionContext,
    ): ProviderResult<CompletionItem[] | CompletionList> {
        if (this.completionProvider) {
            return this.completionProvider.provideCompletionItems(document, position, token);
        }
    }

    public resolveCompletionItem(item: CompletionItem, token: CancellationToken): ProviderResult<CompletionItem> {
        if (this.completionProvider) {
            return this.completionProvider.resolveCompletionItem(item, token);
        }
    }

    public get onDidChangeCodeLenses(): Event<void> | undefined {
        return this.codeLensProvider ? this.codeLensProvider.onDidChangeCodeLenses : undefined;
    }
    public provideCodeLenses(document: TextDocument, token: CancellationToken): ProviderResult<CodeLens[]> {
        if (this.codeLensProvider) {
            return this.codeLensProvider.provideCodeLenses(document, token);
        }
    }
    public provideDocumentSymbols(
        document: TextDocument,
        token: CancellationToken,
    ): ProviderResult<SymbolInformation[] | DocumentSymbol[]> {
        if (this.symbolProvider) {
            return this.symbolProvider.provideDocumentSymbols(document, token);
        }
    }
    public provideSignatureHelp(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        _context: SignatureHelpContext,
    ): ProviderResult<SignatureHelp> {
        if (this.signatureProvider) {
            return this.signatureProvider.provideSignatureHelp(document, position, token);
        }
    }

    public dispose(): void {
        this.registrations.forEach((r) => r.dispose());
        if (this.jediFactory) {
            this.jediFactory.dispose();
        }
    }
}
