// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs';
import { injectable } from 'inversify';
import * as path from 'path';
import { OutputChannel, window } from 'vscode';
import { IInterpreterService, InterpreterType } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { STANDARD_OUTPUT_CHANNEL } from '../constants';
import { ITerminalServiceFactory } from '../terminal/types';
import { ExecutionInfo, IConfigurationService, IOutputChannel } from '../types';
import { isResource, noop } from '../utils/misc';
import { InterpreterUri } from './types';

@injectable()
export abstract class ModuleInstaller {
    public abstract get name(): string;
    public abstract get displayName(): string
    constructor(protected serviceContainer: IServiceContainer) { }
    public async installModule(name: string, resource?: InterpreterUri): Promise<void> {
        sendTelemetryEvent(EventName.PYTHON_INSTALL_PACKAGE, undefined, { installer: this.displayName });
        const uri = isResource(resource) ? resource : undefined;
        const executionInfo = await this.getExecutionInfo(name, resource);
        const terminalService = this.serviceContainer.get<ITerminalServiceFactory>(ITerminalServiceFactory).getTerminalService(uri);

        const executionInfoArgs = await this.processInstallArgs(executionInfo.args, resource);
        if (executionInfo.moduleName) {
            const configService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
            const settings = configService.getSettings(uri);
            const args = ['-m', executionInfo.moduleName].concat(executionInfoArgs);

            const interpreterService = this.serviceContainer.get<IInterpreterService>(IInterpreterService);
            const interpreter = isResource(resource) ? await interpreterService.getActiveInterpreter(resource) : resource;
            const pythonPath = isResource(resource) ? settings.pythonPath : resource.path;
            if (!interpreter || interpreter.type !== InterpreterType.Unknown) {
                await terminalService.sendCommand(pythonPath, args);
            } else if (settings.globalModuleInstallation) {
                if (await this.isPathWritableAsync(path.dirname(pythonPath))) {
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
    private async processInstallArgs(args: string[], resource?: InterpreterUri): Promise<string[]> {
        const indexOfPylint = args.findIndex(arg => arg.toUpperCase() === 'PYLINT');
        if (indexOfPylint === -1) {
            return args;
        }
        const interpreterService = this.serviceContainer.get<IInterpreterService>(IInterpreterService);
        const interpreter = isResource(resource) ? await interpreterService.getActiveInterpreter(resource) : resource;
        // If installing pylint on python 2.x, then use pylint~=1.9.0
        if (interpreter && interpreter.version && interpreter.version.major === 2) {
            const newArgs = [...args];
            // This command could be sent to the terminal, hence '<' needs to be escaped for UNIX.
            newArgs[indexOfPylint] = '"pylint<2.0.0"';
            return newArgs;
        }
        return args;
    }
    private async isPathWritableAsync(directoryPath: string): Promise<boolean> {
        const filePath = `${directoryPath}${path.sep}___vscpTest___`;
        return new Promise<boolean>(resolve => {
            fs.open(filePath, fs.constants.O_CREAT | fs.constants.O_RDWR, (error, fd) => {
                if (!error) {
                    fs.close(fd, () => {
                        fs.unlink(filePath, noop);
                    });
                }
                return resolve(!error);
            });
        });
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
