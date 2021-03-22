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
    LanguageClient,
    Middleware,
    ResponseError,
} from 'vscode-languageclient/node';
import { IJupyterExtensionDependencyManager, IVSCodeNotebook } from '../common/application/types';

import { HiddenFilePrefix, PYTHON_LANGUAGE } from '../common/constants';
import { IFileSystem } from '../common/platform/types';
import { IConfigurationService, IDisposableRegistry, IExtensions } from '../common/types';
import { isThenable } from '../common/utils/async';
import { StopWatch } from '../common/utils/stopWatch';
import { IEnvironmentVariablesProvider } from '../common/variables/types';
import { IServiceContainer } from '../ioc/types';
import { NotebookMiddlewareAddon } from '../jupyter/languageserver/notebookMiddlewareAddon';
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

    public workspace = {
        configuration: async (
            params: ConfigurationParams,
            token: CancellationToken,
            next: ConfigurationRequest.HandlerSignature,
        ) => {
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
    private notebookAddon: NotebookMiddlewareAddon | undefined;

    private connected = false; // Default to not forwarding to VS code.

    public constructor(
        readonly serviceContainer: IServiceContainer,
        serverType: LanguageServerType,
        getClient: () => LanguageClient | undefined,
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
        } else if (serverType === LanguageServerType.JediLSP) {
            this.eventName = EventName.JEDI_LANGUAGE_SERVER_REQUEST;
        } else {
            return;
        }

        const jupyterDependencyManager = this.serviceContainer.get<IJupyterExtensionDependencyManager>(
            IJupyterExtensionDependencyManager,
        );
        const notebookApi = this.serviceContainer.get<IVSCodeNotebook>(IVSCodeNotebook);
        const disposables = this.serviceContainer.get<IDisposableRegistry>(IDisposableRegistry) || [];
        const extensions = this.serviceContainer.get<IExtensions>(IExtensions);
        const fileSystem = this.serviceContainer.get<IFileSystem>(IFileSystem);

        // Enable notebook support if jupyter support is installed
        if (jupyterDependencyManager && jupyterDependencyManager.isJupyterExtensionInstalled) {
            this.notebookAddon = new NotebookMiddlewareAddon(
                notebookApi,
                getClient,
                fileSystem,
                PYTHON_LANGUAGE,
                /.*\.ipynb/m,
            );
        }
        disposables.push(
            extensions?.onDidChange(() => {
                if (jupyterDependencyManager) {
                    if (this.notebookAddon && !jupyterDependencyManager.isJupyterExtensionInstalled) {
                        this.notebookAddon = undefined;
                    } else if (!this.notebookAddon && jupyterDependencyManager.isJupyterExtensionInstalled) {
                        this.notebookAddon = new NotebookMiddlewareAddon(
                            notebookApi,
                            getClient,
                            fileSystem,
                            PYTHON_LANGUAGE,
                            /.*\.ipynb/m,
                        );
                    }
                }
            }),
        );
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

    @captureTelemetryForLSPMethod(
        'textDocument/completion',
        debounceFrequentCall,
        LanguageClientMiddleware.completionLengthMeasure,
    )
    public provideCompletionItem() {
        if (this.connected) {
            return this.callNext('provideCompletionItem', arguments);
        }
    }

    private static completionLengthMeasure(
        _obj: LanguageClientMiddleware,
        result: CompletionItem[] | CompletionList,
    ): Record<string, number> {
        const resultLength = Array.isArray(result) ? result.length : result.items.length;
        return { resultLength };
    }

    @captureTelemetryForLSPMethod('textDocument/hover', debounceFrequentCall)
    public provideHover() {
        if (this.connected) {
            return this.callNext('provideHover', arguments);
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

    @captureTelemetryForLSPMethod('completionItem/resolve', debounceFrequentCall)
    public resolveCompletionItem(): ProviderResult<CompletionItem> {
        if (this.connected) {
            return this.callNext('resolveCompletionItem', arguments);
        }
    }

    @captureTelemetryForLSPMethod('textDocument/signatureHelp', debounceFrequentCall)
    public provideSignatureHelp() {
        if (this.connected) {
            return this.callNext('provideSignatureHelp', arguments);
        }
    }

    @captureTelemetryForLSPMethod('textDocument/definition', debounceRareCall)
    public provideDefinition(): ProviderResult<Definition | DefinitionLink[]> {
        if (this.connected) {
            return this.callNext('provideDefinition', arguments);
        }
    }

    @captureTelemetryForLSPMethod('textDocument/references', debounceRareCall)
    public provideReferences(): ProviderResult<Location[]> {
        if (this.connected) {
            return this.callNext('provideReferences', arguments);
        }
    }

    public provideDocumentHighlights(): ProviderResult<DocumentHighlight[]> {
        if (this.connected) {
            return this.callNext('provideDocumentHighlights', arguments);
        }
    }

    @captureTelemetryForLSPMethod('textDocument/documentSymbol', debounceFrequentCall)
    public provideDocumentSymbols(): ProviderResult<SymbolInformation[] | DocumentSymbol[]> {
        if (this.connected) {
            return this.callNext('provideDocumentSymbols', arguments);
        }
    }

    @captureTelemetryForLSPMethod('workspace/symbol', debounceRareCall)
    public provideWorkspaceSymbols(): ProviderResult<SymbolInformation[]> {
        if (this.connected) {
            return this.callNext('provideWorkspaceSymbols', arguments);
        }
    }

    @captureTelemetryForLSPMethod('textDocument/codeAction', debounceFrequentCall)
    public provideCodeActions(): ProviderResult<(Command | CodeAction)[]> {
        if (this.connected) {
            return this.callNext('provideCodeActions', arguments);
        }
    }

    @captureTelemetryForLSPMethod('textDocument/codeLens', debounceFrequentCall)
    public provideCodeLenses(): ProviderResult<CodeLens[]> {
        if (this.connected) {
            return this.callNext('provideCodeLenses', arguments);
        }
    }

    @captureTelemetryForLSPMethod('codeLens/resolve', debounceFrequentCall)
    public resolveCodeLens(): ProviderResult<CodeLens> {
        if (this.connected) {
            return this.callNext('resolveCodeLens', arguments);
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

    @captureTelemetryForLSPMethod('textDocument/rename', debounceRareCall)
    public provideRenameEdits(): ProviderResult<WorkspaceEdit> {
        if (this.connected) {
            return this.callNext('provideRenameEdits', arguments);
        }
    }

    @captureTelemetryForLSPMethod('textDocument/prepareRename', debounceRareCall)
    public prepareRename(): ProviderResult<
        | Range
        | {
              range: Range;
              placeholder: string;
          }
    > {
        if (this.connected) {
            return this.callNext('prepareRename', arguments);
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

    @captureTelemetryForLSPMethod('textDocument/declaration', debounceRareCall)
    public provideDeclaration(): ProviderResult<VDeclaration> {
        if (this.connected) {
            return this.callNext('provideDeclaration', arguments);
        }
    }

    private callNext(funcName: keyof NotebookMiddlewareAddon, args: IArguments) {
        // This function uses the last argument to call the 'next' item. If we're allowing notebook
        // middleware, it calls into the notebook middleware first.
        if (this.notebookAddon) {
            // It would be nice to use args.callee, but not supported in strict mode

            return (this.notebookAddon as any)[funcName](...args);
        } else {
            return args[args.length - 1](...args);
        }
    }
}

function captureTelemetryForLSPMethod(
    method: string,
    debounceMilliseconds: number,
    lazyMeasures?: (this_: any, result: any) => Record<string, number>,
) {
    return function (_target: Object, _propertyKey: string, descriptor: TypedPropertyDescriptor<any>) {
        const originalMethod = descriptor.value;

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

            // Replace all slashes in the method name so it doesn't get scrubbed by vscode-extension-telemetry.
            const formattedMethod = method.replace(/\//g, '.');

            const properties = {
                lsVersion: this.serverVersion || 'unknown',
                method: formattedMethod,
            };

            const stopWatch = new StopWatch();
            const sendTelemetry = (result: any) => {
                let measures: number | Record<string, number> = stopWatch.elapsedTime;
                if (lazyMeasures) {
                    measures = {
                        duration: measures,
                        ...lazyMeasures(this, result),
                    };
                }
                sendTelemetryEvent(eventName, measures, properties);
                return result;
            };

            let result = originalMethod.apply(this, args);

            if (isThenable<any>(result)) {
                return result.then(sendTelemetry);
            }

            sendTelemetry(result);

            return result;
        };

        return descriptor;
    };
}
