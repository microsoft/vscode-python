// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import * as path from 'path';
import { OutputChannel, Uri, window } from 'vscode';
import { IInterpreterService, InterpreterType, PythonInterpreter } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { STANDARD_OUTPUT_CHANNEL } from '../constants';
import { IFileSystem } from '../platform/types';
import { ITerminalServiceFactory } from '../terminal/types';
import { ExecutionInfo, IConfigurationService, IOutputChannel } from '../types';
import { InterpreterUri } from './types';

@injectable()
export abstract class ModuleInstaller {
    public abstract get name(): string;
    public abstract get displayName(): string
    constructor(protected serviceContainer: IServiceContainer) { }
    public async installModule(name: string, resource?: InterpreterUri): Promise<void> {
        sendTelemetryEvent(EventName.PYTHON_INSTALL_PACKAGE, undefined, { installer: this.displayName });
        const uri = resource && resource instanceof Uri ? resource : undefined;
        const executionInfo = await this.getExecutionInfo(name, resource);
        const terminalService = this.serviceContainer.get<ITerminalServiceFactory>(ITerminalServiceFactory).getTerminalService(uri);

        const interpreterService = this.serviceContainer.get<IInterpreterService>(IInterpreterService);
        const interpreter = (!resource || resource instanceof Uri) ? await interpreterService.getActiveInterpreter(resource) : resource;
        if (!interpreter){
            throw new Error('Unable to get interprter details');
        }
        const executionInfoArgs = await this.processInstallArgs(executionInfo.args, interpreter);
        if (executionInfo.moduleName) {
            const configService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
            const settings = configService.getSettings((resource && resource instanceof Uri) ? resource : undefined);
            const args = ['-m', executionInfo.moduleName].concat(executionInfoArgs);
            const pythonPath = interpreter.path;

            if (!interpreter || interpreter.type !== InterpreterType.Unknown) {
                await terminalService.sendCommand(pythonPath, args);
            } else if (settings.globalModuleInstallation) {
                const dirname = path.dirname(pythonPath);
                const fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
                const isWritable = ! await fs.isDirReadonly(dirname);
                if (isWritable) {
                    await terminalService.sendCommand(pythonPath, args);
                } else {
                    this.elevatedInstall(pythonPath, args);
                }
            } else {
                await terminalService.sendCommand(pythonPath, args.concat(['--user']));
            }
        } else {
            await terminalService.sendCommand(executionInfo.execPath!, executionInfoArgs);
        }
    }
    public abstract isSupported(resource?: InterpreterUri): Promise<boolean>;
    protected abstract getExecutionInfo(moduleName: string, resource?: InterpreterUri): Promise<ExecutionInfo>;
    private async processInstallArgs(args: string[], interpreter: PythonInterpreter): Promise<string[]> {
        const indexOfPylint = args.findIndex(arg => arg.toUpperCase() === 'PYLINT');
        if (indexOfPylint === -1) {
            return args;
        }

        // If installing pylint on python 2.x, then use pylint~=1.9.0
        if (interpreter && interpreter.version && interpreter.version.major === 2) {
            const newArgs = [...args];
            // This command could be sent to the terminal, hence '<' needs to be escaped for UNIX.
            newArgs[indexOfPylint] = '"pylint<2.0.0"';
            return newArgs;
        }
        return args;
    }

    private elevatedInstall(execPath: string, args: string[]) {
        const options = {
            name: 'VS Code Python'
        };
        const outputChannel = this.serviceContainer.get<OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
        const command = `"${execPath.replace(/\\/g, '/')}" ${args.join(' ')}`;

        outputChannel.appendLine('');
        outputChannel.appendLine(`[Elevated] ${command}`);
        // tslint:disable-next-line:no-require-imports no-var-requires
        const sudo = require('sudo-prompt');

        sudo.exec(command, options, (error: string, stdout: string, stderr: string) => {
            if (error) {
                window.showErrorMessage(error);
            } else {
                outputChannel.show();
                if (stdout) {
                    outputChannel.appendLine('');
                    outputChannel.append(stdout);
                }
                if (stderr) {
                    outputChannel.appendLine('');
                    outputChannel.append(`Warning: ${stderr}`);
                }
            }
        });
    }
}
