// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import * as vscode from 'vscode';
import * as languageClient from 'vscode-languageclient';
import { isTestExecution, STANDARD_OUTPUT_CHANNEL } from '../common/constants';
import { IConfigurationService, IOutputChannel, IPythonSettings } from '../common/types';
import { IInterpreterService, IInterpreterVersionService, PythonInterpreter } from '../interpreter/contracts';
import { versionFromPythonVersionString } from '../interpreter/locators/helpers';
import { IServiceContainer } from '../ioc/types';
import { StopWatch } from '../telemetry/stopWatch';
import { IExtensionActivator } from './types';

const PYTHON = 'python';
const ptvsFolder = 'ptvs';
const ptvsBinaryName = 'Microsoft.PythonTools.VsCode.dll';
const dotNetCommand = 'dotnet';
const languageClientName = 'Python Tools';
const defaultPythonVersion = '2.7';

export class PtvsExtensionActivator implements IExtensionActivator {
  private languageClent: languageClient.LanguageClient;

  constructor(private services: IServiceContainer, private pythonSettings: IPythonSettings) {
  }

  public async activate(context: vscode.ExtensionContext): Promise<boolean> {
    const configuration = this.services.get<IConfigurationService>(IConfigurationService);
    const sw = new StopWatch();

    // The server is implemented in C#
    const commandOptions = { stdio: 'pipe' };
    const serverModule = path.join(context.extensionPath, ptvsFolder, ptvsBinaryName);

    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions: languageClient.ServerOptions = {
      run: { command: dotNetCommand, args: [serverModule], options: commandOptions },
      debug: { command: dotNetCommand, args: [serverModule, '--debug'], options: commandOptions }
    };

    const clientOptions = await this.getPtvsOptions();
    // tslint:disable-next-line:no-console
    console.log(`Options determined: ${sw.elapsedTime} ms`);
    try {
      // Create the language client and start the client.
      this.languageClent = new languageClient.LanguageClient(PYTHON, languageClientName, serverOptions, clientOptions);
      context.subscriptions.push(this.languageClent.start());
    } catch (ex) {
      if (!await configuration.checkDependencies()) {
        throw new Error('.NET Runtime is not installed.');
      }
      throw ex;
    }

    // tslint:disable-next-line:no-console
    console.log(`Language server started: ${sw.elapsedTime} ms`);
    await this.languageClent.onReady();
    // tslint:disable-next-line:no-console
    console.log(`Language server ready: ${sw.elapsedTime} ms`);
    return true;
  }

  public async deactivate(): Promise<void> {
    if (this.languageClent) {
      await this.languageClent.stop();
    }
  }

  private async getPtvsOptions(): Promise<languageClient.LanguageClientOptions> {
    // tslint:disable-next-line:no-any
    const properties = new Map<string, any>();

    // PTVS analysis engine needs full path to the interpreter
    const interpreterService = this.services.get<IInterpreterService>(IInterpreterService);
    const interpreter = await interpreterService.getActiveInterpreter();
    if (!interpreter) {
      throw Error('Interpreter path (pythonPath) is not set or interpreter does not exist.');
    }

    // tslint:disable-next-line:no-string-literal
    properties['InterpreterPath'] = interpreter.path;
    // tslint:disable-next-line:no-string-literal
    properties['UseDefaultDatabase'] = true;

    if (interpreter.displayName) {
      // tslint:disable-next-line:no-string-literal
      properties['Description'] = interpreter.displayName;
    }
    // tslint:disable-next-line:no-string-literal
    properties['Version'] = await this.getInterpreterVersion(interpreter);
    if (isTestExecution()) {
      // tslint:disable-next-line:no-string-literal
      properties['TestEnvironment'] = true;
    }

    const selector: string[] = [PYTHON];
    const outputChannel = this.services.get<vscode.OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
    // Options to control the language client
    return {
      // Register the server for Python documents
      documentSelector: selector,
      synchronize: {
        configurationSection: PYTHON
      },
      outputChannel: outputChannel,
      initializationOptions: {
        interpreter: {
          properties: properties
        }
      }
    };
  }

  private async getInterpreterVersion(interpreter: PythonInterpreter): Promise<string> {
    if (interpreter.version) {
      return interpreter.version;
    }
    const versionService = this.services.get<IInterpreterVersionService>(IInterpreterVersionService);
    const ver = await versionService.getVersion(this.pythonSettings.pythonPath, defaultPythonVersion);
    return versionFromPythonVersionString(ver);
  }
}
