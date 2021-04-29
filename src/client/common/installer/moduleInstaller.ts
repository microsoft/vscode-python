// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import * as path from 'path';
import { CancellationToken, OutputChannel, ProgressLocation, ProgressOptions } from 'vscode';
import { IInterpreterService } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { EnvironmentType, ModuleInstallerType } from '../../pythonEnvironments/info';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { IApplicationShell } from '../application/types';
import { wrapCancellationTokens } from '../cancellation';
import { STANDARD_OUTPUT_CHANNEL } from '../constants';
import { IFileSystem } from '../platform/types';
import * as internalPython from '../process/internal/python';
import { ITerminalServiceFactory, TerminalCreationOptions } from '../terminal/types';
import { ExecutionInfo, IConfigurationService, IOutputChannel, Product } from '../types';
import { Products } from '../utils/localize';
import { isResource } from '../utils/misc';
import { ProductNames } from './productNames';
import { IModuleInstaller, InterpreterUri, ModuleInstallFlags } from './types';

@injectable()
export abstract class ModuleInstaller implements IModuleInstaller {
    public abstract get priority(): number;
    public abstract get name(): string;
    public abstract get displayName(): string;
    public abstract get type(): ModuleInstallerType;

    constructor(protected serviceContainer: IServiceContainer) {}

    public async installModule(
        productOrModuleName: Product | string,
        resource?: InterpreterUri,
        cancel?: CancellationToken,
        flags?: ModuleInstallFlags,
    ): Promise<void> {
        const name =
            typeof productOrModuleName == 'string'
                ? productOrModuleName
                : translateProductToModule(productOrModuleName);
        const productName = typeof productOrModuleName === 'string' ? name : ProductNames.get(productOrModuleName);
        sendTelemetryEvent(EventName.PYTHON_INSTALL_PACKAGE, undefined, { installer: this.displayName, productName });
        const uri = isResource(resource) ? resource : undefined;
        const options: TerminalCreationOptions = {};
        if (isResource(resource)) {
            options.resource = uri;
        } else {
            options.interpreter = resource;
        }
        const executionInfo = await this.getExecutionInfo(name, resource, flags);
        const terminalService = this.serviceContainer
            .get<ITerminalServiceFactory>(ITerminalServiceFactory)
            .getTerminalService(options);
        const install = async (token?: CancellationToken) => {
            const executionInfoArgs = await this.processInstallArgs(executionInfo.args, resource);
            if (executionInfo.moduleName) {
                const configService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
                const settings = configService.getSettings(uri);

                const interpreterService = this.serviceContainer.get<IInterpreterService>(IInterpreterService);
                const interpreter = isResource(resource)
                    ? await interpreterService.getActiveInterpreter(resource)
                    : resource;
                const pythonPath = isResource(resource) ? settings.pythonPath : resource.path;
                const args = internalPython.execModule(executionInfo.moduleName, executionInfoArgs);
                if (!interpreter || interpreter.envType !== EnvironmentType.Unknown) {
                    await terminalService.sendCommand(pythonPath, args, token);
                } else if (settings.globalModuleInstallation) {
                    const fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
                    if (await fs.isDirReadonly(path.dirname(pythonPath)).catch((_err) => true)) {
                        this.elevatedInstall(pythonPath, args);
                    } else {
                        await terminalService.sendCommand(pythonPath, args, token);
                    }
                } else {
                    await terminalService.sendCommand(pythonPath, args.concat(['--user']), token);
                }
            } else {
                await terminalService.sendCommand(executionInfo.execPath!, executionInfoArgs, token);
            }
        };

        // Display progress indicator if we have ability to cancel this operation from calling code.
        // This is required as its possible the installation can take a long time.
        // (i.e. if installation takes a long time in terminal or like, a progress indicator is necessary to let user know what is being waited on).
        if (cancel) {
            const shell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
            const options: ProgressOptions = {
                location: ProgressLocation.Notification,
                cancellable: true,
                title: Products.installingModule().format(name),
            };
            await shell.withProgress(options, async (_, token: CancellationToken) =>
                install(wrapCancellationTokens(token, cancel)),
            );
        } else {
            await install(cancel);
        }
    }
    public abstract isSupported(resource?: InterpreterUri): Promise<boolean>;

    protected elevatedInstall(execPath: string, args: string[]) {
        const options = {
            name: 'VS Code Python',
        };
        const outputChannel = this.serviceContainer.get<OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
        const command = `"${execPath.replace(/\\/g, '/')}" ${args.join(' ')}`;

        outputChannel.appendLine('');
        outputChannel.appendLine(`[Elevated] ${command}`);

        const sudo = require('sudo-prompt');

        sudo.exec(command, options, async (error: string, stdout: string, stderr: string) => {
            if (error) {
                const shell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
                await shell.showErrorMessage(error);
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
    protected abstract getExecutionInfo(
        moduleName: string,
        resource?: InterpreterUri,
        flags?: ModuleInstallFlags,
    ): Promise<ExecutionInfo>;
    private async processInstallArgs(args: string[], resource?: InterpreterUri): Promise<string[]> {
        const indexOfPylint = args.findIndex((arg) => arg.toUpperCase() === 'PYLINT');
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
}

export function translateProductToModule(product: Product): string {
    switch (product) {
        case Product.mypy:
            return 'mypy';
        case Product.pylama:
            return 'pylama';
        case Product.prospector:
            return 'prospector';
        case Product.pylint:
            return 'pylint';
        case Product.pytest:
            return 'pytest';
        case Product.autopep8:
            return 'autopep8';
        case Product.black:
            return 'black';
        case Product.pycodestyle:
            return 'pycodestyle';
        case Product.pydocstyle:
            return 'pydocstyle';
        case Product.yapf:
            return 'yapf';
        case Product.flake8:
            return 'flake8';
        case Product.unittest:
            return 'unittest';
        case Product.bandit:
            return 'bandit';
        case Product.jupyter:
            return 'jupyter';
        case Product.notebook:
            return 'notebook';
        case Product.pandas:
            return 'pandas';
        case Product.ipykernel:
            return 'ipykernel';
        case Product.nbconvert:
            return 'nbconvert';
        case Product.kernelspec:
            return 'kernelspec';
        case Product.tensorboard:
            return 'tensorboard';
        case Product.torchProfilerInstallName:
            return 'torch-tb-profiler';
        case Product.torchProfilerImportName:
            return 'torch_tb_profiler';
        default: {
            throw new Error(`Product ${product} cannot be installed as a Python Module.`);
        }
    }
}
