// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as path from 'path';
import {
    CancellationToken,
    CodeAction,
    CodeLens,
    Command,
    CompletionItem,
    Declaration as VDeclaration,
    Definition,
    DefinitionLink,
    Diagnostic,
    Disposable,
    DocumentHighlight,
    DocumentLink,
    DocumentSymbol,
    Location,
    ProviderResult,
    Range,
    SymbolInformation,
    TextEdit,
    Uri,
    WorkspaceEdit,
} from 'vscode';
import {
    ConfigurationParams,
    ConfigurationRequest,
    HandleDiagnosticsSignature,
    Middleware,
    ResponseError,
} from 'vscode-languageclient';

import { HiddenFilePrefix } from '../common/constants';
import { IConfigurationService } from '../common/types';
import { isThenable } from '../common/utils/async';
import { StopWatch } from '../common/utils/stopWatch';
import { IEnvironmentVariablesProvider } from '../common/variables/types';
import { IServiceContainer } from '../ioc/types';
import { EventName } from '../telemetry/constants';
import { LanguageServerType } from './types';

// Only send 100 events per hour.
const globalDebounce = 1000 * 60 * 60;
const globalLimit = 100;

// For calls that are more likely to happen during a session (hover, completion, document symbols).
const debounceFrequentCall = 1000 * 60 * 5;

// For calls that are less likely to happen during a session (go-to-def, workspace symbols).
const debounceRareCall = 1000 * 60;

/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable prefer-rest-params */
/* eslint-disable consistent-return */
/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */

interface SendTelemetryEventFunc {
    (eventName: EventName, measuresOrDurationMs?: Record<string, number> | number, properties?: any, ex?: Error): void;
}

export class LanguageClientMiddlewareBase implements Middleware {
    private readonly eventName: EventName | undefined;

    private readonly lastCaptured = new Map<string, number>();

    private nextWindow = 0;

    private eventCount = 0;

    public workspace = {
        configuration: async (
            params: ConfigurationParams,
            token: CancellationToken,
            next: ConfigurationRequest.HandlerSignature,
        ) => {
            if (!this.serviceContainer) {
                return next(params, token);
            }

            const configService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
            const envService = this.serviceContainer.get<IEnvironmentVariablesProvider>(IEnvironmentVariablesProvider);

            let settings = next(params, token);
            if (isThenable(settings)) {
                settings = await settings;
            }
            if (settings instanceof ResponseError) {
                return settings;
            }

            for (const [i, item] of params.items.entries()) {
                if (item.section === 'python') {
                    const uri = item.scopeUri ? Uri.parse(item.scopeUri) : undefined;
                    // For backwards compatibility, set python.pythonPath to the configured
                    // value as though it were in the user's settings.json file.
                    settings[i].pythonPath = configService.getSettings(uri).pythonPath;

                    const env = await envService.getEnvironmentVariables(uri);
                    const envPYTHONPATH = env.PYTHONPATH;
                    if (envPYTHONPATH) {
                        settings[i]._envPYTHONPATH = envPYTHONPATH;
                    }
                }
            }

            return settings;
        },
    };

    protected notebookAddon: (Middleware & Disposable) | undefined;

    private connected = false; // Default to not forwarding to VS code.

    public constructor(
        readonly serviceContainer: IServiceContainer | undefined,
        serverType: LanguageServerType,
        public readonly sendTelemetryEventFunc: SendTelemetryEventFunc,
        public readonly serverVersion?: string,
    ) {
        this.handleDiagnostics = this.handleDiagnostics.bind(this); // VS Code calls function without context.
        this.didOpen = this.didOpen.bind(this);
        this.didSave = this.didSave.bind(this);
        this.didChange = this.didChange.bind(this);
        this.didClose = this.didClose.bind(this);
        this.willSave = this.willSave.bind(this);
        this.willSaveWaitUntil = this.willSaveWaitUntil.bind(this);

        if (serverType === LanguageServerType.Microsoft) {
            this.eventName = EventName.PYTHON_LANGUAGE_SERVER_REQUEST;
        } else if (serverType === LanguageServerType.Node) {
            this.eventName = EventName.LANGUAGE_SERVER_REQUEST;
        } else if (serverType === LanguageServerType.Jedi) {
            this.eventName = EventName.JEDI_LANGUAGE_SERVER_REQUEST;
        }
    }

    public connect() {
        this.connected = true;
    }

    public disconnect() {
        this.connected = false;
    }

    public didChange() {
        if (this.connected) {
            return this.callNext('didChange', arguments);
        }
    }

    public didOpen() {
        // Special case, open and close happen before we connect.
        return this.callNext('didOpen', arguments);
    }

    public didClose() {
        // Special case, open and close happen before we connect.
        return this.callNext('didClose', arguments);
    }

    public didSave() {
        if (this.connected) {
            return this.callNext('didSave', arguments);
        }
    }

    public willSave() {
        if (this.connected) {
            return this.callNext('willSave', arguments);
        }
    }

    public willSaveWaitUntil() {
        if (this.connected) {
            return this.callNext('willSaveWaitUntil', arguments);
        }
    }

    public provideCompletionItem() {
        if (this.connected) {
            return this.callNextAndSendTelemetry(
                'textDocument/completion',
                debounceFrequentCall,
                'provideCompletionItem',
                arguments,
                (result) => {
                    const resultLength = Array.isArray(result) ? result.length : result.items.length;
                    return { resultLength };
                },
            );
        }
    }

    public provideHover() {
        if (this.connected) {
            return this.callNextAndSendTelemetry('textDocument/hover', debounceFrequentCall, 'provideHover', arguments);
        }
    }

    public handleDiagnostics(uri: Uri, _diagnostics: Diagnostic[], _next: HandleDiagnosticsSignature) {
        if (this.connected) {
            // Skip sending if this is a special file.
            const filePath = uri.fsPath;
            const baseName = filePath ? path.basename(filePath) : undefined;
            if (!baseName || !baseName.startsWith(HiddenFilePrefix)) {
                return this.callNext('handleDiagnostics', arguments);
            }
        }
    }

    public resolveCompletionItem(): ProviderResult<CompletionItem> {
        if (this.connected) {
            return this.callNextAndSendTelemetry(
                'completionItem/resolve',
                debounceFrequentCall,
                'resolveCompletionItem',
                arguments,
            );
        }
    }

    public provideSignatureHelp() {
        if (this.connected) {
            return this.callNextAndSendTelemetry(
                'textDocument/signatureHelp',
                debounceFrequentCall,
                'provideSignatureHelp',
                arguments,
            );
        }
    }

    public provideDefinition(): ProviderResult<Definition | DefinitionLink[]> {
        if (this.connected) {
            return this.callNextAndSendTelemetry(
                'textDocument/definition',
                debounceRareCall,
                'provideDefinition',
                arguments,
            );
        }
    }

    public provideReferences(): ProviderResult<Location[]> {
        if (this.connected) {
            return this.callNextAndSendTelemetry(
                'textDocument/references',
                debounceRareCall,
                'provideReferences',
                arguments,
            );
        }
    }

    public provideDocumentHighlights(): ProviderResult<DocumentHighlight[]> {
        if (this.connected) {
            return this.callNext('provideDocumentHighlights', arguments);
        }
    }

    public provideDocumentSymbols(): ProviderResult<SymbolInformation[] | DocumentSymbol[]> {
        if (this.connected) {
            return this.callNextAndSendTelemetry(
                'textDocument/documentSymbol',
                debounceFrequentCall,
                'provideDocumentSymbols',
                arguments,
            );
        }
    }

    public provideWorkspaceSymbols(): ProviderResult<SymbolInformation[]> {
        if (this.connected) {
            return this.callNextAndSendTelemetry(
                'workspace/symbol',
                debounceRareCall,
                'provideWorkspaceSymbols',
                arguments,
            );
        }
    }

    public provideCodeActions(): ProviderResult<(Command | CodeAction)[]> {
        if (this.connected) {
            return this.callNextAndSendTelemetry(
                'textDocument/codeAction',
                debounceFrequentCall,
                'provideCodeActions',
                arguments,
            );
        }
    }

    public provideCodeLenses(): ProviderResult<CodeLens[]> {
        if (this.connected) {
            return this.callNextAndSendTelemetry(
                'textDocument/codeLens',
                debounceFrequentCall,
                'provideCodeLenses',
                arguments,
            );
        }
    }

    public resolveCodeLens(): ProviderResult<CodeLens> {
        if (this.connected) {
            return this.callNextAndSendTelemetry(
                'codeLens/resolve',
                debounceFrequentCall,
                'resolveCodeLens',
                arguments,
            );
        }
    }

    public provideDocumentFormattingEdits(): ProviderResult<TextEdit[]> {
        if (this.connected) {
            return this.callNext('provideDocumentFormattingEdits', arguments);
        }
    }

    public provideDocumentRangeFormattingEdits(): ProviderResult<TextEdit[]> {
        if (this.connected) {
            return this.callNext('provideDocumentRangeFormattingEdits', arguments);
        }
    }

    public provideOnTypeFormattingEdits(): ProviderResult<TextEdit[]> {
        if (this.connected) {
            return this.callNext('provideOnTypeFormattingEdits', arguments);
        }
    }

    public provideRenameEdits(): ProviderResult<WorkspaceEdit> {
        if (this.connected) {
            return this.callNextAndSendTelemetry(
                'textDocument/rename',
                debounceRareCall,
                'provideRenameEdits',
                arguments,
            );
        }
    }

    public prepareRename(): ProviderResult<
        | Range
        | {
              range: Range;
              placeholder: string;
          }
    > {
        if (this.connected) {
            return this.callNextAndSendTelemetry(
                'textDocument/prepareRename',
                debounceRareCall,
                'prepareRename',
                arguments,
            );
        }
    }

    public provideDocumentLinks(): ProviderResult<DocumentLink[]> {
        if (this.connected) {
            return this.callNext('provideDocumentLinks', arguments);
        }
    }

    public resolveDocumentLink(): ProviderResult<DocumentLink> {
        if (this.connected) {
            return this.callNext('resolveDocumentLink', arguments);
        }
    }

    public provideDeclaration(): ProviderResult<VDeclaration> {
        if (this.connected) {
            return this.callNextAndSendTelemetry(
                'textDocument/declaration',
                debounceRareCall,
                'provideDeclaration',
                arguments,
            );
        }
    }

    private callNext(funcName: keyof Middleware, args: IArguments) {
        // This function uses the last argument to call the 'next' item. If we're allowing notebook
        // middleware, it calls into the notebook middleware first.
        if (this.notebookAddon && (this.notebookAddon as any)[funcName]) {
            // It would be nice to use args.callee, but not supported in strict mode
            return (this.notebookAddon as any)[funcName](...args);
        }

        return args[args.length - 1](...args);
    }

    private callNextAndSendTelemetry(
        lspMethod: string,
        debounceMilliseconds: number,
        funcName: keyof Middleware,
        args: IArguments,
        lazyMeasures?: (this_: any, result: any) => Record<string, number>,
    ) {
        const now = Date.now();
        const stopWatch = new StopWatch();
        let calledNext = false;

        // Change the 'last' argument (which is our next) in order to track if
        // telemetry should be sent or not.
        const changedArgs = [...args];

        // Track whether or not the middleware called the 'next' function (which means it actually sent a request)
        changedArgs[changedArgs.length - 1] = (...nextArgs: any) => {
            // If the 'next' function is called, then legit request was made.
            calledNext = true;

            // Then call the original 'next'
            return args[args.length - 1](...nextArgs);
        };

        // Check if we need to reset the event count (if we're past the globalDebounce time)
        if (now > this.nextWindow) {
            // Past the end of the last window, reset.
            this.nextWindow = now + globalDebounce;
            this.eventCount = 0;
        }
        const lastCapture = this.lastCaptured.get(lspMethod);

        const sendTelemetry = (result: any) => {
            // Skip doing anything if not allowed
            // We should have:
            // - called the next function in the middleware (this means a request was actually sent)
            // - eventcount is not over the global limit
            // - elapsed time since we sent this event is greater than debounce time
            if (
                this.eventName &&
                calledNext &&
                this.eventCount < globalLimit &&
                (!lastCapture || now - lastCapture > debounceMilliseconds)
            ) {
                // We're sending, so update event count and last captured time
                this.lastCaptured.set(lspMethod, now);
                this.eventCount += 1;

                // Replace all slashes in the method name so it doesn't get scrubbed by vscode-extension-telemetry.
                const formattedMethod = lspMethod.replace(/\//g, '.');

                const properties = {
                    lsVersion: this.serverVersion || 'unknown',
                    method: formattedMethod,
                };

                let measures: number | Record<string, number> = stopWatch.elapsedTime;
                if (lazyMeasures) {
                    measures = {
                        duration: measures,
                        ...lazyMeasures(this, result),
                    };
                }

                this.sendTelemetryEventFunc(this.eventName, measures, properties);
            }
            return result;
        };

        // Try to call the 'next' function in the middleware chain
        const result = this.callNext(funcName, changedArgs as any);

        // Then wait for the result before sending telemetry
        if (isThenable<any>(result)) {
            return result.then(sendTelemetry);
        }
        return sendTelemetry(result);
    }
}
