// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { ExtensionContext, OutputChannel } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient';
import { IApplicationShell } from '../common/application/types';
import { isTestExecution, STANDARD_OUTPUT_CHANNEL } from '../common/constants';
import '../common/extensions';
import { IProcessService, IPythonExecutionFactory } from '../common/process/types';
import { StopWatch } from '../common/stopWatch';
import { IConfigurationService, IOutputChannel, IPythonSettings } from '../common/types';
import { IInterpreterService } from '../interpreter/contracts';
import { IServiceContainer } from '../ioc/types';
import { AnalysisEngineDownloader } from './downloader';
import { IExtensionActivator } from './types';

const PYTHON = 'python';
const analysisEngineBinaryName = 'Microsoft.PythonTools.VsCode.dll';
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
    private languageClient: LanguageClient | undefined;

    constructor(private readonly services: IServiceContainer, pythonSettings: IPythonSettings) {
        this.executionFactory = this.services.get<IPythonExecutionFactory>(IPythonExecutionFactory);
        this.configuration = this.services.get<IConfigurationService>(IConfigurationService);
        this.appShell = this.services.get<IApplicationShell>(IApplicationShell);
        this.output = this.services.get<OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
    }

    public async activate(context: ExtensionContext): Promise<boolean> {
        const sw = new StopWatch();

        const clientOptions = await this.getAnalysisOptions(context);
        if (!clientOptions) {
            return false;
        }
        this.output.appendLine(`Options determined: ${sw.elapsedTime} ms`);

        if (!await this.tryStartLanguageServer(context, clientOptions, true)) {
            const downloader = new AnalysisEngineDownloader(this.services, analysisEngineFolder);
            await downloader.downloadAnalysisEngine(context);
            if (!await this.tryStartLanguageServer(context, clientOptions, false)) {
                return false;
            }
        }

        // tslint:disable-next-line:no-console
        this.output.appendLine(`Language server started: ${sw.elapsedTime} ms`);
        await this.languageClient!.onReady();
        this.output.appendLine(`Language server ready: ${sw.elapsedTime} ms`);
        return true;
    }

    public async deactivate(): Promise<void> {
        if (this.languageClient) {
            await this.languageClient.stop();
        }
    }

    private async tryStartLanguageServer(context: ExtensionContext, clientOptions: LanguageClientOptions, checkRuntime: boolean): Promise<boolean> {
        const commandOptions = { stdio: 'pipe' };
        const serverModule = path.join(context.extensionPath, analysisEngineFolder, analysisEngineBinaryName);
        const serverOptions: ServerOptions = {
            run: { command: dotNetCommand, args: [serverModule], options: commandOptions },
            debug: { command: dotNetCommand, args: [serverModule, '--debug'], options: commandOptions }
        };

        try {
            // Create the language client and start the client.
            this.languageClient = new LanguageClient(PYTHON, languageClientName, serverOptions, clientOptions);
            context.subscriptions.push(this.languageClient.start());
            return true;
        } catch (ex) {
            if (checkRuntime && !await this.checkRuntime()) {
                this.appShell.showErrorMessage(`.NET Runtime appears to be installed but the language server did not start. Error ${ex}`);
            } else {
                this.appShell.showErrorMessage(`Language server failed to start. Error ${ex}`);
            }
        }
        return false;
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

    private async checkRuntime(): Promise<boolean> {
        if (!await this.isDotNetInstalled()) {
            const appShell = this.services.get<IApplicationShell>(IApplicationShell);
            if (await appShell.showErrorMessage('Python Tools require .NET Core Runtime. Would you like to install it now?', 'Yes', 'No') === 'Yes') {
                appShell.openUrl('https://www.microsoft.com/net/download/core#/runtime');
                appShell.showWarningMessage('Please restart VS Code after .NET Runtime installation is complete.');
            }
            return false;
        }
        return true;
    }

    private async isDotNetInstalled(): Promise<boolean> {
        const ps = this.services.get<IProcessService>(IProcessService);
        const result = await ps.exec('dotnet', ['--version']).catch(() => { return { stdout: '' }; });
        return result.stdout.trim().startsWith('2.');
    }

}
