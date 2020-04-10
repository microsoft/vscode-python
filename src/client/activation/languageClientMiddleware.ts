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
    Declaration as VDeclaration,
    Definition,
    DefinitionLink,
    Diagnostic,
    DocumentHighlight,
    DocumentLink,
    DocumentSymbol,
    FormattingOptions,
    Location,
    Position,
    Position as VPosition,
    ProviderResult,
    Range,
    SignatureHelp,
    SignatureHelpContext,
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

import { ProvideDeclarationSignature } from 'vscode-languageclient/lib/declaration';
import { HiddenFilePrefix } from '../common/constants';
import { CollectLSRequestTiming, CollectNodeLSRequestTiming } from '../common/experimentGroups';
import { IExperimentsManager, IPythonExtensionBanner } from '../common/types';
import { StopWatch } from '../common/utils/stopWatch';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { LanguageServerType } from './types';

// Only send 100 events per hour.
const globalDebounce = 1000 * 60 * 60;
const globalLimit = 100;

// For calls that are more likely to happen during a session (hover, completion, document symbols).
const debounceFrequentCall = 1000 * 60 * 5;

// For calls that are less likely to happen during a session (go-to-def, workspace symbols).
const debounceRareCall = 1000 * 60;

export class LanguageClientMiddleware implements Middleware {
    // These are public so that the captureTelemetryForLSPMethod decorator can access them.
    public readonly eventName: EventName | undefined;
    public readonly lastCaptured = new Map<string, number>();
    public nextWindow: number = 0;
    public eventCount: number = 0;

    private connected = false; // Default to not forwarding to VS code.

    public constructor(
        private readonly surveyBanner: IPythonExtensionBanner,
        experimentsManager: IExperimentsManager,
        serverType: LanguageServerType,
        public readonly serverVersion?: string
    ) {
        this.handleDiagnostics = this.handleDiagnostics.bind(this); // VS Code calls function without context.

        let group: { experiment: string; control: string } | undefined;

        if (serverType === LanguageServerType.Microsoft) {
            this.eventName = EventName.PYTHON_LANGUAGE_SERVER_REQUEST;
            group = CollectLSRequestTiming;
        } else if (serverType === LanguageServerType.Node) {
            this.eventName = EventName.LANGUAGE_SERVER_REQUEST;
            group = CollectNodeLSRequestTiming;
        } else {
            return;
        }

        if (!experimentsManager.inExperiment(group.experiment)) {
            this.eventName = undefined;
            experimentsManager.sendTelemetryIfInExperiment(group.control);
        }
    }

    public connect() {
        this.connected = true;
    }

    public disconnect() {
        this.connected = false;
    }

    @captureTelemetryForLSPMethod('textDocument/completion', debounceFrequentCall)
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

    @captureTelemetryForLSPMethod('textDocument/hover', debounceFrequentCall)
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

    @captureTelemetryForLSPMethod('completionItem/resolve', debounceFrequentCall)
    public resolveCompletionItem(
        item: CompletionItem,
        token: CancellationToken,
        next: ResolveCompletionItemSignature
    ): ProviderResult<CompletionItem> {
        if (this.connected) {
            return next(item, token);
        }
    }

    @captureTelemetryForLSPMethod('textDocument/signatureHelp', debounceFrequentCall)
    public provideSignatureHelp(
        document: TextDocument,
        position: Position,
        context: SignatureHelpContext,
        token: CancellationToken,
        next: ProvideSignatureHelpSignature
    ): ProviderResult<SignatureHelp> {
        if (this.connected) {
            return next(document, position, context, token);
        }
    }

    @captureTelemetryForLSPMethod('textDocument/definition', debounceRareCall)
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

    @captureTelemetryForLSPMethod('textDocument/references', debounceRareCall)
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

    @captureTelemetryForLSPMethod('textDocument/documentSymbol', debounceFrequentCall)
    public provideDocumentSymbols(
        document: TextDocument,
        token: CancellationToken,
        next: ProvideDocumentSymbolsSignature
    ): ProviderResult<SymbolInformation[] | DocumentSymbol[]> {
        if (this.connected) {
            return next(document, token);
        }
    }

    @captureTelemetryForLSPMethod('workspace/symbol', debounceRareCall)
    public provideWorkspaceSymbols(
        query: string,
        token: CancellationToken,
        next: ProvideWorkspaceSymbolsSignature
    ): ProviderResult<SymbolInformation[]> {
        if (this.connected) {
            return next(query, token);
        }
    }

    @captureTelemetryForLSPMethod('textDocument/codeAction', debounceFrequentCall)
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

    @captureTelemetryForLSPMethod('textDocument/codeLens', debounceFrequentCall)
    public provideCodeLenses(
        document: TextDocument,
        token: CancellationToken,
        next: ProvideCodeLensesSignature
    ): ProviderResult<CodeLens[]> {
        if (this.connected) {
            return next(document, token);
        }
    }

    @captureTelemetryForLSPMethod('codeLens/resolve', debounceFrequentCall)
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

    @captureTelemetryForLSPMethod('textDocument/rename', debounceRareCall)
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

    @captureTelemetryForLSPMethod('textDocument/prepareRename', debounceRareCall)
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

    @captureTelemetryForLSPMethod('textDocument/declaration', debounceRareCall)
    public provideDeclaration(
        document: TextDocument,
        position: VPosition,
        token: CancellationToken,
        next: ProvideDeclarationSignature
    ): ProviderResult<VDeclaration> {
        if (this.connected) {
            return next(document, position, token);
        }
    }
}

function captureTelemetryForLSPMethod(method: string, debounceMilliseconds: number) {
    // tslint:disable-next-line:no-function-expression no-any
    return function (_target: Object, _propertyKey: string, descriptor: TypedPropertyDescriptor<any>) {
        const originalMethod = descriptor.value;

        // tslint:disable-next-line:no-any
        descriptor.value = function (this: LanguageClientMiddleware, ...args: any[]) {
            const eventName = this.eventName;
            if (!eventName) {
                return originalMethod.apply(this, args);
            }

            const now = Date.now();

            if (now > this.nextWindow) {
                // Past the end of the last window, reset.
                this.nextWindow = now + globalDebounce;
                this.eventCount = 0;
            } else if (this.eventCount >= globalLimit) {
                // Sent too many events in this window, don't send.
                return originalMethod.apply(this, args);
            }

            const lastCapture = this.lastCaptured.get(method);
            if (lastCapture && now - lastCapture < debounceMilliseconds) {
                return originalMethod.apply(this, args);
            }

            this.lastCaptured.set(method, now);
            this.eventCount += 1;

            const properties = {
                lsVersion: this.serverVersion || 'unknown',
                method: method
            };

            const stopWatch = new StopWatch();
            // tslint:disable-next-line:no-unsafe-any
            const result = originalMethod.apply(this, args);

            // tslint:disable-next-line:no-unsafe-any
            if (result && typeof result.then === 'function') {
                (result as Thenable<void>).then(() => {
                    sendTelemetryEvent(eventName, stopWatch.elapsedTime, properties);
                });
            } else {
                sendTelemetryEvent(eventName, stopWatch.elapsedTime, properties);
            }

            return result;
        };

        return descriptor;
    };
}
