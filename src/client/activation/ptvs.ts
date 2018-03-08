// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import * as vscode from 'vscode';
import * as languageClient from 'vscode-languageclient';
import { STANDARD_OUTPUT_CHANNEL } from '../common/constants';
import { IConfigurationService, IOutputChannel, IPythonSettings } from '../common/types';
import { IInterpreterService } from '../interpreter/contracts';
import { IServiceContainer } from '../ioc/types';
import { IExtensionActivator } from './types';

export class PtvsExtensionActivator implements IExtensionActivator {
  private PYTHON = 'python';
  private languageClent: languageClient.LanguageClient;

  public async activate(context: vscode.ExtensionContext, services: IServiceContainer, pythonSettings: IPythonSettings): Promise<boolean> {
    const configuration = services.get<IConfigurationService>(IConfigurationService);
    if (! await configuration.checkDependencies()) {
      throw new Error('.NET Runtime is not installed.');
    }

    // The server is implemented in C#
    const commandOptions = { stdio: 'pipe' };
    const serverModule = path.join(context.extensionPath, 'ptvs', 'Microsoft.PythonTools.VsCode.dll');

    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions: languageClient.ServerOptions = {
      run: { command: 'dotnet', args: [serverModule], options: commandOptions },
      debug: { command: 'dotnet', args: [serverModule, '--debug'], options: commandOptions }
    };

    const clientOptions = await this.getPtvsOptions(services, pythonSettings);
    // Create the language client and start the client.
    this.languageClent = new languageClient.LanguageClient(this.PYTHON, 'Python Tools', serverOptions, clientOptions);
    context.subscriptions.push(this.languageClent.start());

    await this.languageClent.onReady();
    return true;
  }

  public async deactivate(): Promise<void> {
    if (this.languageClent) {
      await this.languageClent.stop();
    }
  }

  private async getPtvsOptions(services: IServiceContainer, pythonSettings: IPythonSettings): Promise<languageClient.LanguageClientOptions> {
    // tslint:disable-next-line:no-any
    const properties = new Map<string, any>();
    // tslint:disable-next-line:no-string-literal
    properties['InterpreterPath'] = pythonSettings.pythonPath;
    // tslint:disable-next-line:no-string-literal
    properties['UseDefaultDatabase'] = true;

    const interpreserService = services.get<IInterpreterService>(IInterpreterService);
    const interpreter = await interpreserService.getActiveInterpreter();
    if (interpreter) {
      if (interpreter.displayName) {
        // tslint:disable-next-line:no-string-literal
        properties['Description'] = interpreter.displayName;
      }

      if (interpreter.version) {
        // tslint:disable-next-line:no-string-literal
        properties['Version'] = interpreter.version;
      } else if (interpreter.displayName) {
        // tslint:disable-next-line:no-string-literal
        properties['Version'] = interpreter.displayName.indexOf('3.') > 0 ? '3.6' : '2.7';
      }
    }

    const selector: string[] = [this.PYTHON];
    const outputChannel = services.get<vscode.OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
    // Options to control the language client
    return {
      // Register the server for Python documents
      documentSelector: selector,
      synchronize: {
        configurationSection: this.PYTHON
      },
      outputChannel: outputChannel,
      initializationOptions: {
        interpreter: {
          properties: properties
        }
      }
    };
  }
}
