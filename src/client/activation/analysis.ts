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
import { IProcessService } from '../common/process/types';
import { StopWatch } from '../common/stopWatch';
import { IConfigurationService, IOutputChannel, IPythonSettings } from '../common/types';
import { IEnvironmentVariablesProvider } from '../common/variables/types';
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
        return ErrorAction.Shutdown;
    }
    public closed(): CloseAction {
        this.deferred.reject();
        return CloseAction.DoNotRestart;
    }
}

export class AnalysisExtensionActivator implements IExtensionActivator {
    private readonly configuration: IConfigurationService;
    private readonly appShell: IApplicationShell;
    private readonly output: OutputChannel;
    private readonly fs: IFileSystem;
    private readonly sw = new StopWatch();
    private readonly platformData: PlatformData;
    private languageClient: LanguageClient | undefined;

    constructor(private readonly services: IServiceContainer, pythonSettings: IPythonSettings) {
        this.configuration = this.services.get<IConfigurationService>(IConfigurationService);
        this.appShell = this.services.get<IApplicationShell>(IApplicationShell);
        this.output = this.services.get<OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
        this.fs = this.services.get<IFileSystem>(IFileSystem);
        this.platformData = new PlatformData(services.get<IPlatformService>(IPlatformService), this.fs);
    }

    public async activate(context: ExtensionContext): Promise<boolean> {
        const clientOptions = await this.getAnalysisOptions(context);
        if (!clientOptions) {
            return false;
        }
        return this.startLanguageServer(context, clientOptions);
    }

    public async deactivate(): Promise<void> {
        if (this.languageClient) {
            await this.languageClient.stop();
        }
    }

    private async startLanguageServer(context: ExtensionContext, clientOptions: LanguageClientOptions): Promise<boolean> {
        // Determine if we are running MSIL/Universal via dotnet or self-contained app.
        const mscorlib = path.join(context.extensionPath, analysisEngineFolder, 'mscorlib.dll');
        let downloadPackage = false;

        const reporter = getTelemetryReporter();
        reporter.sendTelemetryEvent(PYTHON_ANALYSIS_ENGINE_ENABLED);

        if (!await this.fs.fileExistsAsync(mscorlib)) {
            // Depends on .NET Runtime or SDK
            this.languageClient = this.createSimpleLanguageClient(context, clientOptions);
            try {
                await this.tryStartLanguageClient(context, this.languageClient);
                return true;
            } catch (ex) {
                if (await this.isDotNetInstalled()) {
                    this.appShell.showErrorMessage(`.NET Runtime appears to be installed but the language server did not start. Error ${ex}`);
                    reporter.sendTelemetryEvent(PYTHON_ANALYSIS_ENGINE_ERROR, { error: 'Failed to start (MSIL)' });
                    return false;
                }
                // No .NET Runtime, no mscorlib - need to download self-contained package.
                downloadPackage = true;
            }
        }

        if (downloadPackage) {
            const downloader = new AnalysisEngineDownloader(this.services, analysisEngineFolder);
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
                .catch(deferred.reject);
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
            appShell.showErrorMessage('Unable to determine path to Python interpreter.');
            return;
        }

        // tslint:disable-next-line:no-string-literal
        properties['InterpreterPath'] = interpreterData.path;
        // tslint:disable-next-line:no-string-literal
        properties['Version'] = interpreterData.version;
        // tslint:disable-next-line:no-string-literal
        properties['PrefixPath'] = interpreterData.prefix;
        // tslint:disable-next-line:no-string-literal
        properties['DatabasePath'] = path.join(context.extensionPath, analysisEngineFolder);

        let searchPaths = interpreterData.searchPaths;
        const settings = this.configuration.getSettings();
        if (settings.autoComplete) {
            const extraPaths = settings.autoComplete.extraPaths;
            if (extraPaths && extraPaths.length > 0) {
                searchPaths = `${searchPaths};${extraPaths.join(';')}`;
            }
        }

        const envProvider = this.services.get<IEnvironmentVariablesProvider>(IEnvironmentVariablesProvider);
        const pythonPath = (await envProvider.getEnvironmentVariables()).PYTHONPATH;

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
                    trimDocumentationLines: false,
                    maxDocumentationLineLength: 0,
                    trimDocumentationText: false,
                    maxDocumentationTextLength: 0
                },
                asyncStartup: true,
                testEnvironment: isTestExecution()
            }
        };
    }

    private async isDotNetInstalled(): Promise<boolean> {
        const ps = this.services.get<IProcessService>(IProcessService);
        const result = await ps.exec('dotnet', ['--version']).catch(() => { return { stdout: '' }; });
        return result.stdout.trim().startsWith('2.');
    }
}
