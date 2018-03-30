// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { ExtensionContext, OutputChannel } from 'vscode';
import { Disposable, LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient';
import { IApplicationShell } from '../common/application/types';
import { isTestExecution, STANDARD_OUTPUT_CHANNEL } from '../common/constants';
import '../common/extensions';
import { IFileSystem, IPlatformService } from '../common/platform/types';
import { IProcessService, IPythonExecutionFactory } from '../common/process/types';
import { StopWatch } from '../common/stopWatch';
import { IConfigurationService, IOutputChannel, IPythonSettings } from '../common/types';
import { IInterpreterService } from '../interpreter/contracts';
import { IServiceContainer } from '../ioc/types';
import { AnalysisEngineDownloader } from './downloader';
import { PlatformData } from './platformData';
import { IExtensionActivator } from './types';

const PYTHON = 'python';
const dotNetCommand = 'dotnet';
const languageClientName = 'Python Tools';
const analysisEngineFolder = 'analysis';

class InterpreterData {
    constructor(public readonly version: string, public readonly prefix: string) { }
}

export class AnalysisExtensionActivator implements IExtensionActivator {
    private readonly executionFactory: IPythonExecutionFactory;
    private readonly configuration: IConfigurationService;
    private readonly appShell: IApplicationShell;
    private readonly output: OutputChannel;
    private readonly fs: IFileSystem;
    private readonly sw = new StopWatch();
    private readonly platformData: PlatformData;
    private languageClient: LanguageClient | undefined;

    constructor(private readonly services: IServiceContainer, pythonSettings: IPythonSettings) {
        this.executionFactory = this.services.get<IPythonExecutionFactory>(IPythonExecutionFactory);
        this.configuration = this.services.get<IConfigurationService>(IConfigurationService);
        this.appShell = this.services.get<IApplicationShell>(IApplicationShell);
        this.output = this.services.get<OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
        this.fs = this.services.get<IFileSystem>(IFileSystem);
        this.platformData = new PlatformData(services.get<IPlatformService>(IPlatformService));
    }

    public async activate(context: ExtensionContext): Promise<boolean> {
        const clientOptions = await this.getAnalysisOptions(context);
        if (!clientOptions) {
            return false;
        }
        this.output.appendLine(`Options determined: ${this.sw.elapsedTime} ms`);
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

        if (!await this.fs.fileExistsAsync(mscorlib)) {
            // Depends on .NET Runtime or SDK
            this.languageClient = this.createSimpleLanguageClient(context, clientOptions);
            const e = await this.tryStartLanguageClient(context, this.languageClient);
            if (!e) {
                return true;
            }
            if (await this.isDotNetInstalled()) {
                this.appShell.showErrorMessage(`.NET Runtime appears to be installed but the language server did not start. Error ${e}`);
                return false;
            }
            // No .NET Runtime, no mscorlib - need to download self-contained package.
            downloadPackage = true;
        }

        if (downloadPackage) {
            const downloader = new AnalysisEngineDownloader(this.services, analysisEngineFolder);
            await downloader.downloadAnalysisEngine(context);
        }

        const serverModule = path.join(context.extensionPath, analysisEngineFolder, this.platformData.getEngineExecutableName());
        // Now try to start self-contained app
        this.languageClient = this.createSelfContainedLanguageClient(context, serverModule, clientOptions);
        const error = await this.tryStartLanguageClient(context, this.languageClient);
        if (!error) {
            return true;
        }
        this.appShell.showErrorMessage(`Language server failed to start. Error ${error}`);
        return false;
    }

    private async tryStartLanguageClient(context: ExtensionContext, lc: LanguageClient): Promise<Error> {
        let disposable: Disposable | undefined;
        try {
            disposable = lc.start();
            await lc.onReady();
            this.output.appendLine(`Language server ready: ${this.sw.elapsedTime} ms`);
            context.subscriptions.push(disposable);
        } catch (ex) {
            if (disposable) {
                disposable.dispose();
                return ex;
            }
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
        const interpreterService = this.services.get<IInterpreterService>(IInterpreterService);
        const interpreter = await interpreterService.getActiveInterpreter();

        if (interpreter) {
            // tslint:disable-next-line:no-string-literal
            properties['InterpreterPath'] = interpreter.path;
            if (interpreter.displayName) {
                // tslint:disable-next-line:no-string-literal
                properties['Description'] = interpreter.displayName;
            }
            const interpreterData = await this.getInterpreterData();

            // tslint:disable-next-line:no-string-literal
            properties['Version'] = interpreterData.version;
            // tslint:disable-next-line:no-string-literal
            properties['PrefixPath'] = interpreterData.prefix;
            // tslint:disable-next-line:no-string-literal
            properties['DatabasePath'] = path.join(context.extensionPath, analysisEngineFolder);

            let searchPaths = await this.getSearchPaths();
            const settings = this.configuration.getSettings();
            if (settings.autoComplete) {
                const extraPaths = settings.autoComplete.extraPaths;
                if (extraPaths && extraPaths.length > 0) {
                    searchPaths = `${searchPaths};${extraPaths.join(';')}`;
                }
            }
            // tslint:disable-next-line:no-string-literal
            properties['SearchPaths'] = searchPaths;

            if (isTestExecution()) {
                // tslint:disable-next-line:no-string-literal
                properties['TestEnvironment'] = true;
            }
        } else {
            const appShell = this.services.get<IApplicationShell>(IApplicationShell);
            const pythonPath = this.configuration.getSettings().pythonPath;
            appShell.showErrorMessage(`Interpreter ${pythonPath} does not exist.`);
            return;
        }

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
                }
            }
        };
    }

    private async getInterpreterData(): Promise<InterpreterData> {
        // Not appropriate for multiroot workspaces.
        // See https://github.com/Microsoft/vscode-python/issues/1149
        const execService = await this.executionFactory.create();
        const result = await execService.exec(['-c', 'import sys; print(sys.version_info); print(sys.prefix)'], {});
        // 2.7.14 (v2.7.14:84471935ed, Sep 16 2017, 20:19:30) <<SOMETIMES NEW LINE HERE>>
        // [MSC v.1500 32 bit (Intel)]
        // C:\Python27
        if (!result.stdout) {
            throw Error('Unable to determine Python interpreter version and system prefix.');
        }
        const output = result.stdout.splitLines({ removeEmptyEntries: true, trim: true });
        if (!output || output.length < 2) {
            throw Error('Unable to parse version and and system prefix from the Python interpreter output.');
        }
        const majorMatches = output[0].match(/major=(\d*?),/);
        const minorMatches = output[0].match(/minor=(\d*?),/);
        if (!majorMatches || majorMatches.length < 2 || !minorMatches || minorMatches.length < 2) {
            throw Error('Unable to parse interpreter version.');
        }
        const prefix = output[output.length - 1];
        return new InterpreterData(`${majorMatches[1]}.${minorMatches[1]}`, prefix);
    }

    private async getSearchPaths(): Promise<string> {
        // Not appropriate for multiroot workspaces.
        // See https://github.com/Microsoft/vscode-python/issues/1149
        const execService = await this.executionFactory.create();
        const result = await execService.exec(['-c', 'import sys; print(sys.path);'], {});
        if (!result.stdout) {
            throw Error('Unable to determine Python interpreter search paths.');
        }
        // tslint:disable-next-line:no-unnecessary-local-variable
        const paths = result.stdout.split(',')
            .filter(p => this.isValidPath(p))
            .map(p => this.pathCleanup(p));
        return paths.join(';');
    }

    private pathCleanup(s: string): string {
        s = s.trim();
        if (s[0] === '\'') {
            s = s.substr(1);
        }
        if (s[s.length - 1] === ']') {
            s = s.substr(0, s.length - 1);
        }
        if (s[s.length - 1] === '\'') {
            s = s.substr(0, s.length - 1);
        }
        return s;
    }

    private isValidPath(s: string): boolean {
        return s.length > 0 && s[0] !== '[';
    }

    // private async checkNetCoreRuntime(): Promise<boolean> {
    //     if (!await this.isDotNetInstalled()) {
    //         const appShell = this.services.get<IApplicationShell>(IApplicationShell);
    //         if (await appShell.showErrorMessage('Python Tools require .NET Core Runtime. Would you like to install it now?', 'Yes', 'No') === 'Yes') {
    //             appShell.openUrl('https://www.microsoft.com/net/download/core#/runtime');
    //             appShell.showWarningMessage('Please restart VS Code after .NET Runtime installation is complete.');
    //         }
    //         return false;
    //     }
    //     return true;
    // }

    private async isDotNetInstalled(): Promise<boolean> {
        const ps = this.services.get<IProcessService>(IProcessService);
        const result = await ps.exec('dotnet', ['--version']).catch(() => { return { stdout: '' }; });
        return result.stdout.trim().startsWith('2.');
    }
}
