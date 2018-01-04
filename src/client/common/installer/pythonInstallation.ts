// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { OutputChannel } from 'vscode';
import { IInterpreterLocatorService, INTERPRETER_LOCATOR_SERVICE, InterpreterType } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { IApplicationShell } from '../application/types';
import { IPythonSettings } from '../configSettings';
import { STANDARD_OUTPUT_CHANNEL } from '../constants';
import { IFileSystem, IPlatformService } from '../platform/types';
import { IProcessService } from '../process/types';
import { IOutputChannel } from '../types';

export class PythonInstaller {
    private locator: IInterpreterLocatorService;
    private process: IProcessService;
    private fs: IFileSystem;
    private outputChannel: OutputChannel;
    private _platform: IPlatformService;
    private _shell: IApplicationShell;

    constructor(private serviceContainer: IServiceContainer) {
        this.locator = serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, INTERPRETER_LOCATOR_SERVICE);
   }

    public async checkPythonInstallation(settings: IPythonSettings): Promise<boolean> {
        if (settings.disableInstallationChecks === true) {
            return true;
        }
        let interpreters = await this.locator.getInterpreters();
        if (interpreters.length > 0) {
            if (this.platform.isMac &&
                settings.pythonPath === 'python' &&
                interpreters[0].type === InterpreterType.Unknown) {
                await this.shell.showWarningMessage('Selected interpreter is MacOS system Python which is not recommended. Please select different interpreter');
            }
            return true;
        }

        if (!this.platform.isMac) {
            // Windows or Linux
            await this.shell.showErrorMessage('Python is not installed. Please download and install Python before using the extension.');
            this.shell.openUrl('https://www.python.org/downloads');
            return false;
        }

        this.process = this.serviceContainer.get<IProcessService>(IProcessService);
        this.fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
        this.outputChannel = this.serviceContainer.get<OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);

        if (this.platform.isMac) {
            if (await this.shell.showErrorMessage('Python that comes with MacOS is not supported. Would you like to install regular Python now?', 'Yes', 'No') === 'Yes') {
                const brewInstalled = await this.ensureBrew();
                if (!brewInstalled) {
                    await this.shell.showErrorMessage('Unable to install Homebrew package manager. Try installing it manually.');
                    this.shell.openUrl('https://brew.sh');
                    return false;
                }
                await this.executeAndOutput('brew', ['install', 'python']);
            }
        }

        interpreters = await this.locator.getInterpreters();
        return interpreters.length > 0;
    }

    private isBrewInstalled(): Promise<boolean> {
        return this.fs.fileExistsAsync('/usr/local/bin/brew');
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

    private get shell(): IApplicationShell {
        if (!this._shell) {
            this._shell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
        }
        return this._shell;
    }

    private get platform(): IPlatformService {
        if (!this._platform) {
            this._platform = this.serviceContainer.get<IPlatformService>(IPlatformService);
        }
        return this._platform;
    }
}
