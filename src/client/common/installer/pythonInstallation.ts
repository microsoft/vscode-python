// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { IInterpreterHelper, IInterpreterLocatorService, IInterpreterService, INTERPRETER_LOCATOR_SERVICE, InterpreterType } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { IApplicationShell } from '../application/types';
import { IPlatformService } from '../platform/types';
import { IPythonSettings } from '../types';

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
            const helper = this.serviceContainer.get<IInterpreterHelper>(IInterpreterHelper);
            if (platform.isMac && helper.isMacDefaultPythonPath(settings.pythonPath)) {
                const interpreterService = this.serviceContainer.get<IInterpreterService>(IInterpreterService);
                const interpreter = await interpreterService.getActiveInterpreter();
                if (interpreter && interpreter.type === InterpreterType.Unknown) {
                    await this.shell.showWarningMessage('Selected interpreter is macOS system Python which is not recommended. Please select different interpreter');
                }
            }
            return true;
        }

        const download = 'Download';
        if (await this.shell.showErrorMessage('Python is not installed. Please download and install Python before using the extension.', download) === download) {
            this.shell.openUrl('https://www.python.org/downloads');
        }
        return false;
    }
}
