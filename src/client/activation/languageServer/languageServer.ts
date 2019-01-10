// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import {
    CancellationToken, CompletionContext, OutputChannel, Position,
    TextDocument, Uri
} from 'vscode';
import {
    Disposable, LanguageClient, LanguageClientOptions,
    ProvideCompletionItemsSignature, ServerOptions
} from 'vscode-languageclient';
import {
    IApplicationShell, ICommandManager, IWorkspaceService
} from '../../common/application/types';
import { PythonSettings } from '../../common/configSettings';
// tslint:disable-next-line:ordered-imports
import { isTestExecution, STANDARD_OUTPUT_CHANNEL } from '../../common/constants';
import { Logger } from '../../common/logger';
import { IFileSystem } from '../../common/platform/types';
import {
    BANNER_NAME_LS_SURVEY, DeprecatedFeatureInfo, IConfigurationService,
    IDisposableRegistry, IExtensionContext, IFeatureDeprecationManager, ILogger,
    IOutputChannel, IPathUtils, IPythonExtensionBanner, IPythonSettings
} from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import { LanguageService } from '../../common/utils/localize';
import { StopWatch } from '../../common/utils/stopWatch';
import { IEnvironmentVariablesProvider } from '../../common/variables/types';
import { IServiceContainer } from '../../ioc/types';
import { LanguageServerSymbolProvider } from '../../providers/symbolProvider';
import { sendTelemetryEvent } from '../../telemetry';
import {
    PYTHON_LANGUAGE_SERVER_ENABLED,
    PYTHON_LANGUAGE_SERVER_ERROR,
    PYTHON_LANGUAGE_SERVER_TELEMETRY
} from '../../telemetry/constants';
import { IUnitTestManagementService } from '../../unittests/types';
import { LanguageServerDownloader } from '../downloader';
import { InterpreterData, InterpreterDataService } from '../interpreterDataService';
import { ProgressReporting } from '../progress';
import { IExtensionActivator, ILanguageServerFolderService, ILanguageServerPlatformData } from '../types';

const PYTHON = 'python';
const dotNetCommand = 'dotnet';
const languageClientName = 'Python Tools';
const loadExtensionCommand = 'python._loadLanguageServerExtension';
const buildSymbolsCmdDeprecatedInfo: DeprecatedFeatureInfo = {
    doNotDisplayPromptStateKey: 'SHOW_DEPRECATED_FEATURE_PROMPT_BUILD_WORKSPACE_SYMBOLS',
    message: 'The command \'Python: Build Workspace Symbols\' is deprecated when using the Python Language Server. The Python Language Server builds symbols in the workspace in the background.',
    moreInfoUrl: 'https://github.com/Microsoft/vscode-python/issues/2267#issuecomment-408996859',
    commands: ['python.buildWorkspaceSymbols']
};

@injectable()
export class LanguageServerExtensionActivator implements IExtensionActivator {
    protected languageServerFolder!: string;
    protected readonly platformData: ILanguageServerPlatformData;
    protected readonly context: IExtensionContext;
    private readonly configuration: IConfigurationService;
    private readonly appShell: IApplicationShell;
    private readonly output: OutputChannel;
    private readonly fs: IFileSystem;
    private readonly sw = new StopWatch();
    private readonly startupCompleted: Deferred<void>;
    private readonly disposables: Disposable[] = [];
    private readonly workspace: IWorkspaceService;
    private readonly root: Uri | undefined;

    private languageClient: LanguageClient | undefined;
    private interpreterHash: string = '';
    private excludedFiles: string[] = [];
    private typeshedPaths: string[] = [];
    private loadExtensionArgs: {} | undefined;
    private surveyBanner: IPythonExtensionBanner;
    private languageServerFolderService: ILanguageServerFolderService;

    constructor(@inject(IServiceContainer) private readonly services: IServiceContainer) {
        this.context = this.services.get<IExtensionContext>(IExtensionContext);
        this.configuration = this.services.get<IConfigurationService>(IConfigurationService);
        this.appShell = this.services.get<IApplicationShell>(IApplicationShell);
        this.output = this.services.get<OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
        this.fs = this.services.get<IFileSystem>(IFileSystem);
        this.platformData = this.services.get<ILanguageServerPlatformData>(ILanguageServerPlatformData);
        this.workspace = this.services.get<IWorkspaceService>(IWorkspaceService);
        this.languageServerFolderService = this.services.get<ILanguageServerFolderService>(ILanguageServerFolderService);
        const deprecationManager: IFeatureDeprecationManager =
            this.services.get<IFeatureDeprecationManager>(IFeatureDeprecationManager);

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

        deprecationManager.registerDeprecation(buildSymbolsCmdDeprecatedInfo);

        this.surveyBanner = services.get<IPythonExtensionBanner>(IPythonExtensionBanner, BANNER_NAME_LS_SURVEY);

        (this.configuration.getSettings() as PythonSettings).addListener('change', this.onSettingsChanged.bind(this));
    }

    public async activate(): Promise<boolean> {
        this.sw.reset();
        this.languageServerFolder = await this.languageServerFolderService.getLanguageServerFolderName();
        const clientOptions = await this.getAnalysisOptions();
        if (!clientOptions) {
            return false;
        }
        this.startupCompleted.promise.then(() => {
            const testManagementService = this.services.get<IUnitTestManagementService>(IUnitTestManagementService);
            testManagementService.activate()
                .then(() => testManagementService.activateCodeLenses(new LanguageServerSymbolProvider(this.languageClient!)))
                .catch(ex => this.services.get<ILogger>(ILogger).logError('Failed to activate Unit Tests', ex));
        }).ignoreErrors();

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
        (this.configuration.getSettings() as PythonSettings).removeListener('change', this.onSettingsChanged.bind(this));
    }

    protected async startLanguageClient(): Promise<void> {
        this.context.subscriptions.push(this.languageClient!.start());
        await this.serverReady();
        const disposables = this.services.get<Disposable[]>(IDisposableRegistry);
        const progressReporting = new ProgressReporting(this.languageClient!);
        disposables.push(progressReporting);
    }

    protected async createSelfContainedLanguageClient(serverModule: string, clientOptions: LanguageClientOptions): Promise<LanguageClient> {
        const options = { stdio: 'pipe' };
        const serverOptions: ServerOptions = {
            run: { command: serverModule, rgs: [], options: options },
            debug: { command: serverModule, args: ['--debug'], options }
        };
        const vscodeLanaguageClient = await import('vscode-languageclient');
        return new vscodeLanaguageClient.LanguageClient(PYTHON, languageClientName, serverOptions, clientOptions);
    }

    protected async startLanguageServer(clientOptions: LanguageClientOptions): Promise<boolean> {
        // Determine if we are running MSIL/Universal via dotnet or self-contained app.
        sendTelemetryEvent(PYTHON_LANGUAGE_SERVER_ENABLED);

        const settings = this.configuration.getSettings();
        if (!settings.downloadLanguageServer) {
            // Depends on .NET Runtime or SDK. Typically development-only case.
            this.languageClient = await this.createSimpleLanguageClient(clientOptions);
            await this.startLanguageClient();
            return true;
        }
        const mscorlib = path.join(this.context.extensionPath, this.languageServerFolder, 'mscorlib.dll');
        if (!await this.fs.fileExists(mscorlib)) {
            const downloader = new LanguageServerDownloader(this.platformData, this.languageServerFolder, this.services);
            try {
                await downloader.downloadLanguageServer(this.context);
            } catch (err) {
                return false;
            }
        }

        const serverModule = path.join(this.languageServerFolder, this.platformData.getEngineExecutableName());
        this.languageClient = await this.createSelfContainedLanguageClient(serverModule, clientOptions);
        try {
            await this.startLanguageClient();
            this.languageClient.onTelemetry(telemetryEvent => {
                const eventName = telemetryEvent.EventName ? telemetryEvent.EventName : PYTHON_LANGUAGE_SERVER_TELEMETRY;
                sendTelemetryEvent(eventName, telemetryEvent.Measurements, telemetryEvent.Properties);
            });
            return true;
        } catch (ex) {
            this.appShell.showErrorMessage(LanguageService.lsFailedToStart());
            this.output.appendLine('Language server failed to start.');
            this.output.appendLine(ex);
            sendTelemetryEvent(PYTHON_LANGUAGE_SERVER_ERROR, undefined, { error: 'Failed to start (platform)' });
            return false;
        }
    }

    private async serverReady(): Promise<void> {
        while (!this.languageClient!.initializeResult) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (this.loadExtensionArgs) {
            this.languageClient!.sendRequest('python/loadExtension', this.loadExtensionArgs);
        }

        this.startupCompleted.resolve();
    }

    private async createSimpleLanguageClient(clientOptions: LanguageClientOptions): Promise<LanguageClient> {
        const commandOptions = { stdio: 'pipe' };
        const serverModule = path.join(this.context.extensionPath, this.languageServerFolder, this.platformData.getEngineDllName());
        const serverOptions: ServerOptions = {
            run: { command: dotNetCommand, args: [serverModule], options: commandOptions },
            debug: { command: dotNetCommand, args: [serverModule, '--debug'], options: commandOptions }
        };
        const vscodeLanaguageClient = await import('vscode-languageclient');
        return new vscodeLanaguageClient.LanguageClient(PYTHON, languageClientName, serverOptions, clientOptions);
    }
    // tslint:disable-next-line:member-ordering
    public async getAnalysisOptions(): Promise<LanguageClientOptions | undefined> {
        const properties = new Map<string, {}>();
        let interpreterData: InterpreterData | undefined;
        let pythonPath = '';

        try {
            const interpreterDataService = new InterpreterDataService(this.context, this.services);
            interpreterData = await interpreterDataService.getInterpreterData();
        } catch (ex) {
            Logger.error('Unable to determine path to the Python interpreter. IntelliSense will be limited.', ex);
        }

        this.interpreterHash = interpreterData ? interpreterData.hash : '';
        if (interpreterData) {
            pythonPath = path.dirname(interpreterData.path);
            // tslint:disable-next-line:no-string-literal
            properties['InterpreterPath'] = interpreterData.path;
            // tslint:disable-next-line:no-string-literal
            properties['Version'] = interpreterData.version;
        }

        // tslint:disable-next-line:no-string-literal
        properties['DatabasePath'] = path.join(this.context.extensionPath, this.languageServerFolder);

        let searchPaths = interpreterData ? interpreterData.searchPaths.split(path.delimiter) : [];
        const settings = this.configuration.getSettings();
        if (settings.autoComplete) {
            const extraPaths = settings.autoComplete.extraPaths;
            if (extraPaths && extraPaths.length > 0) {
                searchPaths.push(...extraPaths);
            }
        }
        const envVarsProvider = this.services.get<IEnvironmentVariablesProvider>(IEnvironmentVariablesProvider);
        const vars = await envVarsProvider.getEnvironmentVariables();
        if (vars.PYTHONPATH && vars.PYTHONPATH.length > 0) {
            const pathUtils = this.services.get<IPathUtils>(IPathUtils);
            const paths = vars.PYTHONPATH.split(pathUtils.delimiter).filter(item => item.trim().length > 0);
            searchPaths.push(...paths);
        }
        // Make sure paths do not contain multiple slashes so file URIs
        // in VS Code (Node.js) and in the language server (.NET) match.
        // Note: for the language server paths separator is always ;
        searchPaths.push(pythonPath);
        searchPaths = searchPaths.map(p => path.normalize(p));

        const selector = [{ language: PYTHON, scheme: 'file' }];
        this.excludedFiles = this.getExcludedFiles();
        this.typeshedPaths = this.getTypeshedPaths(settings);

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
                    preferredFormat: 'markdown',
                    trimDocumentationLines: false,
                    maxDocumentationLineLength: 0,
                    trimDocumentationText: false,
                    maxDocumentationTextLength: 0
                },
                searchPaths,
                typeStubSearchPaths: this.typeshedPaths,
                excludeFiles: this.excludedFiles,
                testEnvironment: isTestExecution(),
                analysisUpdates: true,
                traceLogging: true, // Max level, let LS decide through settings actual level of logging.
                asyncStartup: true
            },
            middleware: {
                provideCompletionItem: (document: TextDocument, position: Position, context: CompletionContext, token: CancellationToken, next: ProvideCompletionItemsSignature) => {
                    if (this.surveyBanner) {
                        this.surveyBanner.showBanner().ignoreErrors();
                    }
                    return next(document, position, context, token);
                }
            }
        };
    }

    private getExcludedFiles(): string[] {
        const list: string[] = ['**/Lib/**', '**/site-packages/**'];
        this.getVsCodeExcludeSection('search.exclude', list);
        this.getVsCodeExcludeSection('files.exclude', list);
        this.getVsCodeExcludeSection('files.watcherExclude', list);
        this.getPythonExcludeSection(list);
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

    private getPythonExcludeSection(list: string[]): void {
        const pythonSettings = this.configuration.getSettings(this.root);
        const paths = pythonSettings && pythonSettings.linting ? pythonSettings.linting.ignorePatterns : undefined;
        if (paths && Array.isArray(paths)) {
            paths
                .filter(p => p && p.length > 0)
                .forEach(p => list.push(p));
        }
    }

    private getTypeshedPaths(settings: IPythonSettings): string[] {
        return settings.analysis.typeshedPaths && settings.analysis.typeshedPaths.length > 0
            ? settings.analysis.typeshedPaths
            : [path.join(this.context.extensionPath, this.languageServerFolder, 'Typeshed')];
    }

    private async onSettingsChanged(): Promise<void> {
        const ids = new InterpreterDataService(this.context, this.services);
        const idata = await ids.getInterpreterData();
        if (!idata || idata.hash !== this.interpreterHash) {
            this.interpreterHash = idata ? idata.hash : '';
            await this.restartLanguageServer();
            return;
        }

        const excludedFiles = this.getExcludedFiles();
        await this.restartLanguageServerIfArrayChanged(this.excludedFiles, excludedFiles);

        const settings = this.configuration.getSettings();
        const typeshedPaths = this.getTypeshedPaths(settings);
        await this.restartLanguageServerIfArrayChanged(this.typeshedPaths, typeshedPaths);
    }

    private async restartLanguageServerIfArrayChanged(oldArray: string[], newArray: string[]): Promise<void> {
        if (newArray.length !== oldArray.length) {
            await this.restartLanguageServer();
            return;
        }

        for (let i = 0; i < oldArray.length; i += 1) {
            if (oldArray[i] !== newArray[i]) {
                await this.restartLanguageServer();
                return;
            }
        }
    }

    private async restartLanguageServer(): Promise<void> {
        if (!this.context) {
            return;
        }
        await this.deactivate();
        await this.activate();
    }
}
