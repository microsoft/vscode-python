// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

// tslint:disable-next-line:no-require-imports no-var-requires
const opn = require('opn');

import { inject } from 'inversify';
import { OutputChannel } from 'vscode';
import { IInterpreterLocatorService, INTERPRETER_LOCATOR_SERVICE } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { IApplicationShell } from '../application/types';
import { STANDARD_OUTPUT_CHANNEL } from '../constants';
import { IFileSystem, IPlatformService } from '../platform/types';
import { IProcessService, IPythonExecutionService } from '../process/types';
import { IOutputChannel } from '../types';
import { IPythonInstallation } from './types';

export class PythonInstaller {
    private locator: IInterpreterLocatorService;
    private platform: IPlatformService;
    private process: IProcessService;
    private fs: IFileSystem;
    private outputChannel: OutputChannel;
    private shell: IApplicationShell;

    constructor(private serviceContainer: IServiceContainer) {
        this.locator = serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, INTERPRETER_LOCATOR_SERVICE);
    }

    public async checkPythonInstallation(): Promise<boolean> {
        let interpreters = await this.locator.getInterpreters();
        if (interpreters.length > 0) {
            return true;
        }

        this.platform = this.serviceContainer.get<IPlatformService>(IPlatformService);
        this.process = this.serviceContainer.get<IProcessService>(IProcessService);
        this.fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
        this.outputChannel = this.serviceContainer.get<OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
        this.shell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);

        if (this.platform.isWindows) {
            await this.shell.showErrorMessage('Python is not installed. Please download and install Python before using the extension.');
            opn('https://www.python.org/downloads');
            return false;
        }

        if (this.platform.isMac) {
            if (await this.shell.showErrorMessage('Python that comes with Mac OS is not supported. Would you like to install regular Python now?', 'Yes', 'No') === 'Yes') {
                const brewInstalled = await this.ensureBrew();
                if (!brewInstalled) {
                    await this.shell.showErrorMessage('Unable to install Brew package manager');
                    return false;
                }
                await this.executeAndOutput('brew', ['install', 'python']);
            }
        }

        interpreters = await this.locator.getInterpreters();
        return interpreters.length > 0;
    }

    private isBrewInstalled(): Promise<boolean> {
        return this.fs.existsAsync('/usr/local/bin/brew');
    }

    private async ensureBrew(): Promise<boolean> {
        if (await this.isBrewInstalled()) {
            return true;
        }
        const result = await this.executeAndOutput(
            '/usr/bin/ruby',
            ['-e', '"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"']);
        return result && await this.isBrewInstalled();
    }

    private executeAndOutput(command: string, args: string[]): Promise<boolean> {
        let failed = false;
        this.outputChannel.show();

        const result = this.process.execObservable(command, args, { mergeStdOutErr: true, throwOnStdErr: false });
        result.out.subscribe(output => {
            this.outputChannel.append(output.out);
        }, error => {
            failed = true;
            this.shell.showErrorMessage(`Unable to execute '${command}', error: ${error}`);
        });

        return new Promise<boolean>((resolve, reject) => {
            if (failed) {
                resolve(false);
            }
            result.proc.on('exit', (code, signal) => {
                resolve(!signal);
            });
        });
    }
}
