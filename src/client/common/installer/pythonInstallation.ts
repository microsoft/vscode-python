// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { IInterpreterLocatorService, INTERPRETER_LOCATOR_SERVICE, InterpreterType } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { IApplicationShell } from '../application/types';
import { IPythonSettings } from '../configSettings';
import { IPlatformService } from '../platform/types';

export class PythonInstaller {
    private locator: IInterpreterLocatorService;
    private shell: IApplicationShell;

    constructor(private serviceContainer: IServiceContainer) {
        this.locator = serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, INTERPRETER_LOCATOR_SERVICE);
        this.shell = serviceContainer.get<IApplicationShell>(IApplicationShell);
   }

    public async checkPythonInstallation(settings: IPythonSettings): Promise<boolean> {
        if (settings.disableInstallationChecks === true) {
            return true;
        }
        const interpreters = await this.locator.getInterpreters();
        if (interpreters.length > 0) {
            const platform = this.serviceContainer.get<IPlatformService>(IPlatformService);
            if (platform.isMac &&
                settings.pythonPath === 'python' &&
                interpreters[0].type === InterpreterType.Unknown) {
                await this.shell.showWarningMessage('Selected interpreter is macOS system Python which is not recommended. Please select different interpreter');
            }
            return true;
        }

        await this.shell.showErrorMessage('Python is not installed. Please download and install Python before using the extension.');
        this.shell.openUrl('https://www.python.org/downloads');
        return false;
    }
}
