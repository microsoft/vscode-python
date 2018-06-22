// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { OutputChannel, Uri } from 'vscode';
import { Disposable, LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../common/application/types';
import { isTestExecution, STANDARD_OUTPUT_CHANNEL } from '../common/constants';
import { createDeferred, Deferred } from '../common/helpers';
import { IFileSystem, IPlatformService } from '../common/platform/types';
import { StopWatch } from '../common/stopWatch';
import { IConfigurationService, IExtensionContext, IOutputChannel } from '../common/types';
import { IInterpreterService } from '../interpreter/contracts';
import { IServiceContainer } from '../ioc/types';
import {
    PYTHON_ANALYSIS_ENGINE_DOWNLOADED,
    PYTHON_ANALYSIS_ENGINE_ENABLED,
    PYTHON_ANALYSIS_ENGINE_ERROR
} from '../telemetry/constants';
import { getTelemetryReporter } from '../telemetry/telemetry';
import { AnalysisEngineDownloader } from './downloader';
import { InterpreterData, InterpreterDataService } from './interpreterDataService';
import { PlatformData } from './platformData';
import { IExtensionActivator } from './types';

const PYTHON = 'python';
const dotNetCommand = 'dotnet';
const languageClientName = 'Python Tools';
const analysisEngineFolder = 'analysis';
const loadExtensionCommand = 'python._loadLanguageServerExtension';

@injectable()
export class AnalysisExtensionActivator implements IExtensionActivator {
    private readonly configuration: IConfigurationService;
    private readonly appShell: IApplicationShell;
    private readonly output: OutputChannel;
    private readonly fs: IFileSystem;
    private readonly sw = new StopWatch();
    private readonly platformData: PlatformData;
    private readonly interpreterService: IInterpreterService;
    private readonly startupCompleted: Deferred<void>;
    private readonly disposables: Disposable[] = [];
    private readonly context: IExtensionContext;
    private readonly workspace: IWorkspaceService;
    private readonly root: Uri | undefined;

    private languageClient: LanguageClient | undefined;
    private interpreterHash: string = '';
    private loadExtensionArgs: {} | undefined;

    constructor(@inject(IServiceContainer) private readonly services: IServiceContainer) {
        this.context = this.services.get<IExtensionContext>(IExtensionContext);
        this.configuration = this.services.get<IConfigurationService>(IConfigurationService);
        this.appShell = this.services.get<IApplicationShell>(IApplicationShell);
        this.output = this.services.get<OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
        this.fs = this.services.get<IFileSystem>(IFileSystem);
        this.platformData = new PlatformData(services.get<IPlatformService>(IPlatformService), this.fs);
        this.interpreterService = this.services.get<IInterpreterService>(IInterpreterService);
        this.workspace = this.services.get<IWorkspaceService>(IWorkspaceService);

        // Currently only a single root. Multi-root support is future.
        this.root = this.workspace && this.workspace.hasWorkspaceFolders
            ? this.workspace.workspaceFolders![0]!.uri : undefined;

        this.startupCompleted = createDeferred<void>();
        const commandManager = this.services.get<ICommandManager>(ICommandManager);

        this.disposables.push(commandManager.registerCommand(loadExtensionCommand,
            async (args) => {
                if (this.languageClient) {
                    await this.startupCompleted.promise;
                    this.languageClient.sendRequest('python/loadExtension', args);
                } else {
                    this.loadExtensionArgs = args;
                }
            }
        ));
    }

    public async activate(): Promise<boolean> {
        this.sw.reset();
        const clientOptions = await this.getAnalysisOptions();
        if (!clientOptions) {
            return false;
        }
        this.disposables.push(this.interpreterService.onDidChangeInterpreter(() => this.restartLanguageServer()));
        return this.startLanguageServer(clientOptions);
    }

    public async deactivate(): Promise<void> {
        if (this.languageClient) {
            // Do not await on this
            this.languageClient.stop();
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
            await this.activate();
        }
    }

    private async startLanguageServer(clientOptions: LanguageClientOptions): Promise<boolean> {
        // Determine if we are running MSIL/Universal via dotnet or self-contained app.

        const reporter = getTelemetryReporter();
        reporter.sendTelemetryEvent(PYTHON_ANALYSIS_ENGINE_ENABLED);

        const settings = this.configuration.getSettings();
        if (!settings.downloadCodeAnalysis) {
            // Depends on .NET Runtime or SDK. Typically development-only case.
            this.languageClient = this.createSimpleLanguageClient(clientOptions);
            await this.startLanguageClient();
            return true;
        }

        const mscorlib = path.join(this.context.extensionPath, analysisEngineFolder, 'mscorlib.dll');
        if (!await this.fs.fileExists(mscorlib)) {
            const downloader = new AnalysisEngineDownloader(this.services, analysisEngineFolder);
            await downloader.downloadAnalysisEngine(this.context);
            reporter.sendTelemetryEvent(PYTHON_ANALYSIS_ENGINE_DOWNLOADED);
        }

        const serverModule = path.join(this.context.extensionPath, analysisEngineFolder, this.platformData.getEngineExecutableName());
        this.languageClient = this.createSelfContainedLanguageClient(serverModule, clientOptions);
        try {
            await this.startLanguageClient();
            return true;
        } catch (ex) {
            this.appShell.showErrorMessage(`Language server failed to start. Error ${ex}`);
            reporter.sendTelemetryEvent(PYTHON_ANALYSIS_ENGINE_ERROR, { error: 'Failed to start (platform)' });
            return false;
        }
    }

    private async startLanguageClient(): Promise<void> {
        this.languageClient!.onReady()
            .then(() => {
                this.startupCompleted.resolve();
                if (this.loadExtensionArgs) {
                    this.languageClient!.sendRequest('python/loadExtension', this.loadExtensionArgs);
                    this.loadExtensionArgs = undefined;
                }
            })
            .catch(error => this.startupCompleted.reject(error));

        this.context.subscriptions.push(this.languageClient!.start());
        if (isTestExecution()) {
            await this.startupCompleted.promise;
        }
    }

    private createSimpleLanguageClient(clientOptions: LanguageClientOptions): LanguageClient {
        const commandOptions = { stdio: 'pipe' };
        const serverModule = path.join(this.context.extensionPath, analysisEngineFolder, this.platformData.getEngineDllName());
        const serverOptions: ServerOptions = {
            run: { command: dotNetCommand, args: [serverModule], options: commandOptions },
            debug: { command: dotNetCommand, args: [serverModule, '--debug'], options: commandOptions }
        };
        return new LanguageClient(PYTHON, languageClientName, serverOptions, clientOptions);
    }

    private createSelfContainedLanguageClient(serverModule: string, clientOptions: LanguageClientOptions): LanguageClient {
        const options = { stdio: 'pipe' };
        const serverOptions: ServerOptions = {
            run: { command: serverModule, rgs: [], options: options },
            debug: { command: serverModule, args: ['--debug'], options }
        };
        return new LanguageClient(PYTHON, languageClientName, serverOptions, clientOptions);
    }

    private async getAnalysisOptions(): Promise<LanguageClientOptions | undefined> {
        // tslint:disable-next-line:no-any
        const properties = new Map<string, any>();
        let interpreterData: InterpreterData | undefined;
        let pythonPath = '';

        try {
            const interpreterDataService = new InterpreterDataService(this.context, this.services);
            interpreterData = await interpreterDataService.getInterpreterData();
        } catch (ex) {
            this.appShell.showErrorMessage('Unable to determine path to the Python interpreter. IntelliSense will be limited.');
        }

        this.interpreterHash = interpreterData ? interpreterData.hash : '';
        if (interpreterData) {
            pythonPath = path.dirname(interpreterData.path);
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
        properties['DatabasePath'] = path.join(this.context.extensionPath, analysisEngineFolder);

        // Make sure paths do not contain multiple slashes so file URIs
        // in VS Code (Node.js) and in the language server (.NET) match.
        // Note: for the language server paths separator is always ;
        searchPaths = searchPaths.split(path.delimiter).map(p => path.normalize(p)).join(';');
        // tslint:disable-next-line:no-string-literal
        properties['SearchPaths'] = `${searchPaths};${pythonPath}`;

        const selector = [{ language: PYTHON, scheme: 'file' }];
        const excludeFiles = this.getExcludedFiles();

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
                excludeFiles: excludeFiles,
                testEnvironment: isTestExecution()
            }
        };
    }

    private getExcludedFiles(): string[] {
        const list: string[] = ['**/Lib/**', '**/site-packages/**'];
        this.getVsCodeExcludeSection('search.exclude', list);
        this.getVsCodeExcludeSection('files.exclude', list);
        this.getVsCodeExcludeSection('files.watcherExclude', list);
        this.getPythonExcludeSection('linting.ignorePatterns', list);
        this.getPythonExcludeSection('workspaceSymbols.exclusionPattern', list);
        return list;
    }

    private getVsCodeExcludeSection(setting: string, list: string[]): void {
        const states = this.workspace.getConfiguration(setting, this.root);
        if (states) {
            Object.keys(states)
                .filter(k => (k.indexOf('*') >= 0 || k.indexOf('/') >= 0) && states[k])
                .forEach(p => list.push(p));
        }
    }

    private getPythonExcludeSection(setting: string, list: string[]): void {
        const pythonSettings = this.configuration.getSettings(this.root);
        const paths = pythonSettings && pythonSettings.linting ? pythonSettings.linting.ignorePatterns : undefined;
        if (paths && Array.isArray(paths)) {
            paths
                .filter(p => p && p.length > 0)
                .forEach(p => list.push(p));
        }
    }
}
