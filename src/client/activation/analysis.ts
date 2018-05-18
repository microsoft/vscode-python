// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { ExtensionContext, OutputChannel } from 'vscode';
import { Message } from 'vscode-jsonrpc';
import { CloseAction, Disposable, ErrorAction, ErrorHandler, LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient';
import { IApplicationShell } from '../common/application/types';
import { isTestExecution, STANDARD_OUTPUT_CHANNEL } from '../common/constants';
import { createDeferred, Deferred } from '../common/helpers';
import { IFileSystem, IPlatformService } from '../common/platform/types';
import { StopWatch } from '../common/stopWatch';
import { IConfigurationService, IOutputChannel, IPythonSettings } from '../common/types';
import { IEnvironmentVariablesProvider } from '../common/variables/types';
import { IInterpreterService } from '../interpreter/contracts';
import { IServiceContainer } from '../ioc/types';
import {
    PYTHON_ANALYSIS_ENGINE_DOWNLOADED,
    PYTHON_ANALYSIS_ENGINE_ENABLED,
    PYTHON_ANALYSIS_ENGINE_ERROR,
    PYTHON_ANALYSIS_ENGINE_STARTUP
} from '../telemetry/constants';
import { getTelemetryReporter } from '../telemetry/telemetry';
import { AnalysisEngineDownloader } from './downloader';
import { InterpreterDataService } from './interpreterDataService';
import { PlatformData } from './platformData';
import { IExtensionActivator } from './types';

const PYTHON = 'python';
const dotNetCommand = 'dotnet';
const languageClientName = 'Python Tools';
const analysisEngineFolder = 'analysis';

class LanguageServerStartupErrorHandler implements ErrorHandler {
    constructor(private readonly deferred: Deferred<void>) { }
    public error(error: Error, message: Message, count: number): ErrorAction {
        this.deferred.reject(error);
        return ErrorAction.Continue;
    }
    public closed(): CloseAction {
        this.deferred.reject();
        return CloseAction.Restart;
    }
}

export class AnalysisExtensionActivator implements IExtensionActivator {
    private readonly configuration: IConfigurationService;
    private readonly appShell: IApplicationShell;
    private readonly output: OutputChannel;
    private readonly fs: IFileSystem;
    private readonly sw = new StopWatch();
    private readonly platformData: PlatformData;
    private readonly interpreterService: IInterpreterService;
    private readonly disposables: Disposable[] = [];
    private languageClient: LanguageClient | undefined;
    private context: ExtensionContext | undefined;
    private interpreterHash: string = '';

    constructor(private readonly services: IServiceContainer, pythonSettings: IPythonSettings) {
        this.configuration = this.services.get<IConfigurationService>(IConfigurationService);
        this.appShell = this.services.get<IApplicationShell>(IApplicationShell);
        this.output = this.services.get<OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
        this.fs = this.services.get<IFileSystem>(IFileSystem);
        this.platformData = new PlatformData(services.get<IPlatformService>(IPlatformService), this.fs);
        this.interpreterService = this.services.get<IInterpreterService>(IInterpreterService);
    }

    public async activate(context: ExtensionContext): Promise<boolean> {
        this.sw.reset();
        this.context = context;
        const clientOptions = await this.getAnalysisOptions(context);
        if (!clientOptions) {
            return false;
        }
        this.disposables.push(this.interpreterService.onDidChangeInterpreter(() => this.restartLanguageServer()));
        return this.startLanguageServer(context, clientOptions);
    }

    public async deactivate(): Promise<void> {
        if (this.languageClient) {
            await this.languageClient.stop();
        }
        for (const d of this.disposables) {
            d.dispose();
        }
    }

    private async restartLanguageServer(): Promise<void> {
        if (!this.context) {
            return;
        }
        const ids = new InterpreterDataService(this.context, this.services);
        const idata = await ids.getInterpreterData();
        if (!idata || idata.hash !== this.interpreterHash) {
            this.interpreterHash = idata ? idata.hash : '';
            await this.deactivate();
            await this.activate(this.context);
        }
    }

    private async startLanguageServer(context: ExtensionContext, clientOptions: LanguageClientOptions): Promise<boolean> {
        // Determine if we are running MSIL/Universal via dotnet or self-contained app.
        const mscorlib = path.join(context.extensionPath, analysisEngineFolder, 'mscorlib.dll');
        const downloader = new AnalysisEngineDownloader(this.services, analysisEngineFolder);

        const reporter = getTelemetryReporter();
        reporter.sendTelemetryEvent(PYTHON_ANALYSIS_ENGINE_ENABLED);

        const settings = this.configuration.getSettings();
        if (!settings.downloadCodeAnalysis) {
            // Depends on .NET Runtime or SDK. Typically development-only case.
            this.languageClient = this.createSimpleLanguageClient(context, clientOptions);
            await this.tryStartLanguageClient(context, this.languageClient);
            return true;
        }

        if (!await this.fs.fileExists(mscorlib)) {
            await downloader.downloadAnalysisEngine(context);
            reporter.sendTelemetryEvent(PYTHON_ANALYSIS_ENGINE_DOWNLOADED);
        }

        const serverModule = path.join(context.extensionPath, analysisEngineFolder, this.platformData.getEngineExecutableName());
        // Now try to start self-contained app
        this.languageClient = this.createSelfContainedLanguageClient(context, serverModule, clientOptions);
        try {
            await this.tryStartLanguageClient(context, this.languageClient);
            return true;
        } catch (ex) {
            this.appShell.showErrorMessage(`Language server failed to start. Error ${ex}`);
            reporter.sendTelemetryEvent(PYTHON_ANALYSIS_ENGINE_ERROR, { error: 'Failed to start (platform)' });
            return false;
        }
    }

    private async tryStartLanguageClient(context: ExtensionContext, lc: LanguageClient): Promise<void> {
        let disposable: Disposable | undefined;
        const deferred = createDeferred<void>();
        try {
            const sw = new StopWatch();
            lc.clientOptions.errorHandler = new LanguageServerStartupErrorHandler(deferred);

            disposable = lc.start();
            lc.onReady()
                .then(() => deferred.resolve())
                .catch((reason) => {
                    deferred.reject(reason);
                });
            await deferred.promise;

            this.output.appendLine(`Language server ready: ${this.sw.elapsedTime} ms`);
            context.subscriptions.push(disposable);

            const reporter = getTelemetryReporter();
            reporter.sendTelemetryEvent(PYTHON_ANALYSIS_ENGINE_STARTUP, {}, { startup_time: sw.elapsedTime });
        } catch (ex) {
            if (disposable) {
                disposable.dispose();
            }
            throw ex;
        }
    }

    private createSimpleLanguageClient(context: ExtensionContext, clientOptions: LanguageClientOptions): LanguageClient {
        const commandOptions = { stdio: 'pipe' };
        const serverModule = path.join(context.extensionPath, analysisEngineFolder, this.platformData.getEngineDllName());
        const serverOptions: ServerOptions = {
            run: { command: dotNetCommand, args: [serverModule], options: commandOptions },
            debug: { command: dotNetCommand, args: [serverModule, '--debug'], options: commandOptions }
        };
        return new LanguageClient(PYTHON, languageClientName, serverOptions, clientOptions);
    }

    private createSelfContainedLanguageClient(context: ExtensionContext, serverModule: string, clientOptions: LanguageClientOptions): LanguageClient {
        const options = { stdio: 'pipe' };
        const serverOptions: ServerOptions = {
            run: { command: serverModule, rgs: [], options: options },
            debug: { command: serverModule, args: ['--debug'], options }
        };
        return new LanguageClient(PYTHON, languageClientName, serverOptions, clientOptions);
    }

    private async getAnalysisOptions(context: ExtensionContext): Promise<LanguageClientOptions | undefined> {
        // tslint:disable-next-line:no-any
        const properties = new Map<string, any>();

        // Microsoft Python code analysis engine needs full path to the interpreter
        const interpreterDataService = new InterpreterDataService(context, this.services);
        const interpreterData = await interpreterDataService.getInterpreterData();
        if (!interpreterData) {
            const appShell = this.services.get<IApplicationShell>(IApplicationShell);
            appShell.showWarningMessage('Unable to determine path to Python interpreter. IntelliSense will be limited.');
        }

        if (interpreterData) {
            // tslint:disable-next-line:no-string-literal
            properties['InterpreterPath'] = interpreterData.path;
            // tslint:disable-next-line:no-string-literal
            properties['Version'] = interpreterData.version;
            // tslint:disable-next-line:no-string-literal
            properties['PrefixPath'] = interpreterData.prefix;
        }

        let searchPaths = interpreterData ? interpreterData.searchPaths : '';
        const settings = this.configuration.getSettings();
        if (settings.autoComplete) {
            const extraPaths = settings.autoComplete.extraPaths;
            if (extraPaths && extraPaths.length > 0) {
                searchPaths = `${searchPaths};${extraPaths.join(';')}`;
            }
        }

        // tslint:disable-next-line:no-string-literal
        properties['DatabasePath'] = path.join(context.extensionPath, analysisEngineFolder);

        const envProvider = this.services.get<IEnvironmentVariablesProvider>(IEnvironmentVariablesProvider);
        const pythonPath = (await envProvider.getEnvironmentVariables()).PYTHONPATH;
        this.interpreterHash = interpreterData ? interpreterData.hash : '';

        // tslint:disable-next-line:no-string-literal
        properties['SearchPaths'] = `${searchPaths};${pythonPath ? pythonPath : ''}`;
        const selector: string[] = [PYTHON];

        // Options to control the language client
        return {
            // Register the server for Python documents
            documentSelector: selector,
            synchronize: {
                configurationSection: PYTHON
            },
            outputChannel: this.output,
            initializationOptions: {
                interpreter: {
                    properties
                },
                displayOptions: {
                    preferredFormat: 1, // Markdown
                    trimDocumentationLines: false,
                    maxDocumentationLineLength: 0,
                    trimDocumentationText: false,
                    maxDocumentationTextLength: 0
                },
                asyncStartup: true,
                intelliCodeEnabled: settings.intelliCodeEnabled,
                testEnvironment: isTestExecution()
            }
        };
    }
}
