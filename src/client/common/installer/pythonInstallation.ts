// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { inject } from 'inversify';
import { IInterpreterLocatorService, INTERPRETER_LOCATOR_SERVICE } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { IApplicationShell } from '../application/types';
import { IFileSystem, IPlatformService } from '../platform/types';
import { IProcessService, IPythonExecutionService } from '../process/types';
import { ITerminalService } from '../terminal/types';
import { IPythonInstallation } from './types';

export async function checkPythonInstallation(serviceContainer: IServiceContainer, interpreterManager): Promise<boolean> {
    const shell = serviceContainer.get<IApplicationShell>(IApplicationShell);
    const process = serviceContainer.get<IProcessService>(IProcessService);
    const platform = serviceContainer.get<IPlatformService>(IPlatformService);
    const fs = serviceContainer.get<IFileSystem>(IFileSystem);
    const locator = serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, INTERPRETER_LOCATOR_SERVICE);

    let interpreters = await locator.getInterpreters();
    if (interpreters.length > 0) {
        return true;
    }

    if (platform.isWindows) {
        await shell.showErrorMessage('Python is not installed. Please download and install Python before using the extension.');
        await process.exec('https://www.python.org/downloads', [], {});
        return false;
    }

    if (platform.isMac) {
        if (await shell.showErrorMessage('Python that comes with Mac OS is not supported. Would you like to install regular Python now?', 'Yes', 'No') === 'Yes') {
            const terminal = serviceContainer.get<ITerminalService>(ITerminalService);
            const brewInstalled = await ensureBrew(fs, terminal);
            if (!brewInstalled) {
                await shell.showErrorMessage('Unable to install Brew package manager');
                return false;
            }
            await terminal.sendCommand('brew', ['python']);
            interpreterManager.refresh();
        }
    }

    interpreters = await locator.getInterpreters();
    return interpreters.length > 0;
}

function isBrewInstalled(fs: IFileSystem): Promise<boolean> {
    return fs.existsAsync('/usr/local/bin/brew');
}

async function ensureBrew(fs: IFileSystem, terminal: ITerminalService) {
    if (!isBrewInstalled(fs)) {
        await terminal.sendCommand('/usr/bin/ruby', ['-e', '$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)']);
    }
    return isBrewInstalled(fs);
}
