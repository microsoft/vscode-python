// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as path from 'path';
import {
    CancellationToken,
    CodeAction,
    CodeLens,
    Command,
    CompletionItem,
    CompletionList,
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

type CaptureInfo = {
    lspMethod?: string | undefined;
    debounceMilliseconds?: number;
    lazyMeasures?: (this_: any, result: any) => Record<string, number>;
    funcName: keyof Middleware;
    args: IArguments;
};

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
            return this.callNextAndSendTelemetry({ funcName: 'didChange', args: arguments });
        }
    }

    public didOpen() {
        // Special case, open and close happen before we connect.
        return this.callNextAndSendTelemetry({ funcName: 'didOpen', args: arguments });
    }

    public didClose() {
        // Special case, open and close happen before we connect.
        return this.callNextAndSendTelemetry({ funcName: 'didClose', args: arguments });
    }

    public didSave() {
        if (this.connected) {
            return this.callNextAndSendTelemetry({ funcName: 'didSave', args: arguments });
        }
    }

    public willSave() {
        if (this.connected) {
            return this.callNextAndSendTelemetry({ funcName: 'willSave', args: arguments });
        }
    }

    public willSaveWaitUntil() {
        if (this.connected) {
            return this.callNextAndSendTelemetry({ funcName: 'willSaveWaitUntil', args: arguments });
        }
    }

    public provideCompletionItem() {
        if (this.connected) {
            return this.callNextAndSendTelemetry({
                lspMethod: 'textDocument/completion',
                debounceMilliseconds: debounceFrequentCall,
                lazyMeasures: LanguageClientMiddlewareBase.completionLengthMeasure,
                funcName: 'provideCompletionItem',
                args: arguments,
            });
        }
    }

    private static completionLengthMeasure(
        _obj: LanguageClientMiddlewareBase,
        result: CompletionItem[] | CompletionList,
    ): Record<string, number> {
        const resultLength = Array.isArray(result) ? result.length : result.items.length;
        return { resultLength };
    }

    public provideHover() {
        if (this.connected) {
            return this.callNextAndSendTelemetry({
                lspMethod: 'textDocument/hover',
                debounceMilliseconds: debounceFrequentCall,
                funcName: 'provideHover',
                args: arguments,
            });
        }
    }

    public handleDiagnostics(uri: Uri, _diagnostics: Diagnostic[], _next: HandleDiagnosticsSignature) {
        if (this.connected) {
            // Skip sending if this is a special file.
            const filePath = uri.fsPath;
            const baseName = filePath ? path.basename(filePath) : undefined;
            if (!baseName || !baseName.startsWith(HiddenFilePrefix)) {
                return this.callNextAndSendTelemetry({ funcName: 'handleDiagnostics', args: arguments });
            }
        }
    }

    public resolveCompletionItem(): ProviderResult<CompletionItem> {
        if (this.connected) {
            return this.callNextAndSendTelemetry({
                lspMethod: 'completionItem/resolve',
                debounceMilliseconds: debounceFrequentCall,
                funcName: 'resolveCompletionItem',
                args: arguments,
            });
        }
    }

    public provideSignatureHelp() {
        if (this.connected) {
            return this.callNextAndSendTelemetry({
                lspMethod: 'textDocument/signatureHelp',
                debounceMilliseconds: debounceFrequentCall,
                funcName: 'provideSignatureHelp',
                args: arguments,
            });
        }
    }

    public provideDefinition(): ProviderResult<Definition | DefinitionLink[]> {
        if (this.connected) {
            return this.callNextAndSendTelemetry({
                lspMethod: 'textDocument/definition',
                debounceMilliseconds: debounceRareCall,
                funcName: 'provideDefinition',
                args: arguments,
            });
        }
    }

    public provideReferences(): ProviderResult<Location[]> {
        if (this.connected) {
            return this.callNextAndSendTelemetry({
                lspMethod: 'textDocument/references',
                debounceMilliseconds: debounceRareCall,
                funcName: 'provideReferences',
                args: arguments,
            });
        }
    }

    public provideDocumentHighlights(): ProviderResult<DocumentHighlight[]> {
        if (this.connected) {
            return this.callNextAndSendTelemetry({ funcName: 'provideDocumentHighlights', args: arguments });
        }
    }

    public provideDocumentSymbols(): ProviderResult<SymbolInformation[] | DocumentSymbol[]> {
        if (this.connected) {
            return this.callNextAndSendTelemetry({
                lspMethod: 'textDocument/documentSymbol',
                debounceMilliseconds: debounceFrequentCall,
                funcName: 'provideDocumentSymbols',
                args: arguments,
            });
        }
    }

    public provideWorkspaceSymbols(): ProviderResult<SymbolInformation[]> {
        if (this.connected) {
            return this.callNextAndSendTelemetry({
                lspMethod: 'workspace/symbol',
                debounceMilliseconds: debounceRareCall,
                funcName: 'provideWorkspaceSymbols',
                args: arguments,
            });
        }
    }

    public provideCodeActions(): ProviderResult<(Command | CodeAction)[]> {
        if (this.connected) {
            return this.callNextAndSendTelemetry({
                lspMethod: 'textDocument/codeAction',
                debounceMilliseconds: debounceFrequentCall,
                funcName: 'provideCodeActions',
                args: arguments,
            });
        }
    }

    public provideCodeLenses(): ProviderResult<CodeLens[]> {
        if (this.connected) {
            return this.callNextAndSendTelemetry({
                lspMethod: 'textDocument/codeLens',
                debounceMilliseconds: debounceFrequentCall,
                funcName: 'provideCodeLenses',
                args: arguments,
            });
        }
    }

    public resolveCodeLens(): ProviderResult<CodeLens> {
        if (this.connected) {
            return this.callNextAndSendTelemetry({
                lspMethod: 'codeLens/resolve',
                debounceMilliseconds: debounceFrequentCall,
                funcName: 'resolveCodeLens',
                args: arguments,
            });
        }
    }

    public provideDocumentFormattingEdits(): ProviderResult<TextEdit[]> {
        if (this.connected) {
            return this.callNextAndSendTelemetry({ funcName: 'provideDocumentFormattingEdits', args: arguments });
        }
    }

    public provideDocumentRangeFormattingEdits(): ProviderResult<TextEdit[]> {
        if (this.connected) {
            return this.callNextAndSendTelemetry({ funcName: 'provideDocumentRangeFormattingEdits', args: arguments });
        }
    }

    public provideOnTypeFormattingEdits(): ProviderResult<TextEdit[]> {
        if (this.connected) {
            return this.callNextAndSendTelemetry({ funcName: 'provideOnTypeFormattingEdits', args: arguments });
        }
    }

    public provideRenameEdits(): ProviderResult<WorkspaceEdit> {
        if (this.connected) {
            return this.callNextAndSendTelemetry({
                lspMethod: 'textDocument/rename',
                debounceMilliseconds: debounceRareCall,
                funcName: 'provideRenameEdits',
                args: arguments,
            });
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
            return this.callNextAndSendTelemetry({
                lspMethod: 'textDocument/prepareRename',
                debounceMilliseconds: debounceRareCall,
                funcName: 'prepareRename',
                args: arguments,
            });
        }
    }

    public provideDocumentLinks(): ProviderResult<DocumentLink[]> {
        if (this.connected) {
            return this.callNextAndSendTelemetry({ funcName: 'provideDocumentLinks', args: arguments });
        }
    }

    public resolveDocumentLink(): ProviderResult<DocumentLink> {
        if (this.connected) {
            return this.callNextAndSendTelemetry({ funcName: 'resolveDocumentLink', args: arguments });
        }
    }

    public provideDeclaration(): ProviderResult<VDeclaration> {
        if (this.connected) {
            return this.callNextAndSendTelemetry({
                lspMethod: 'textDocument/declaration',
                debounceMilliseconds: debounceRareCall,
                funcName: 'provideDeclaration',
                args: arguments,
            });
        }
    }

    private callNextAndSendTelemetry(info: CaptureInfo) {
        const now = Date.now();
        const stopWatch = new StopWatch();

        // Change the 'last' argument (which is our next) in order to track if
        // telemetry should be sent or not.
        const changedArgs = [...info.args];

        // Track whether or not the middleware called the 'next' function (which means it actually sent a request)
        let calledNext = false;
        changedArgs[changedArgs.length - 1] = (...nextArgs: any) => {
            // If the 'next' function is called, then legit request was made.
            calledNext = true;

            // Then call the original 'next'
            return info.args[info.args.length - 1](...nextArgs);
        };

        // Check if we need to reset the event count (if we're past the globalDebounce time)
        if (now > this.nextWindow) {
            // Past the end of the last window, reset.
            this.nextWindow = now + globalDebounce;
            this.eventCount = 0;
        }
        const lastCapture = info.lspMethod ? this.lastCaptured.get(info.lspMethod) : undefined;

        const sendTelemetry = (result: any) => {
            // Skip doing anything if not allowed
            // We should have:
            // - called the next function in the middleware (this means a request was actually sent)
            // - eventcount is not over the global limit
            // - elapsed time since we sent this event is greater than debounce time
            if (
                info.lspMethod &&
                this.eventName &&
                calledNext &&
                this.eventCount < globalLimit &&
                info.debounceMilliseconds &&
                (!lastCapture || now - lastCapture > info.debounceMilliseconds)
            ) {
                // We're sending, so update event count and last captured time
                this.lastCaptured.set(info.lspMethod, now);
                this.eventCount += 1;

                // Replace all slashes in the method name so it doesn't get scrubbed by vscode-extension-telemetry.
                const formattedMethod = info.lspMethod.replace(/\//g, '.');

                const properties = {
                    lsVersion: this.serverVersion || 'unknown',
                    method: formattedMethod,
                };

                let measures: number | Record<string, number> = stopWatch.elapsedTime;
                if (info.lazyMeasures) {
                    measures = {
                        duration: measures,
                        ...info.lazyMeasures(this, result),
                    };
                }

                this.sendTelemetryEventFunc(this.eventName, measures, properties);
            }
            return result;
        };

        // This function uses the last argument to call the 'next' item. If we're allowing notebook
        // middleware, it calls into the notebook middleware first.
        let result: any;
        if (this.notebookAddon && (this.notebookAddon as any)[info.funcName]) {
            // It would be nice to use args.callee, but not supported in strict mode
            result = (this.notebookAddon as any)[info.funcName](...changedArgs);
        } else {
            result = info.args[info.args.length - 1](...info.args);
        }

        // Then wait for the result before sending telemetry
        if (isThenable<any>(result)) {
            return result.then(sendTelemetry);
        }

        sendTelemetry(result);
        return result;
    }
}
