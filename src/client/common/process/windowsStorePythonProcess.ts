// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IWindowsStoreInterpreter } from '../../interpreter/locators/types';
import { IServiceContainer } from '../../ioc/types';
import { PythonExecutionService } from './pythonProcess';
import { IProcessService } from './types';

export class WindowsStorePythonProcess extends PythonExecutionService {
    constructor(
        serviceContainer: IServiceContainer,
        procService: IProcessService,
        pythonPath: string,
        private readonly windowsStoreInterpreter: IWindowsStoreInterpreter
    ) {
        super(serviceContainer, procService, pythonPath);
    }
    /**
     * With windows store python apps, we have generally use the symlinked python executable.
     * The actual file is not accessible by the user due to permission issues (& rest of exension fails when using that executable).
     * Hence lets not resolve the executable using sys.executable for windows store python interpreters.
     *
     * @returns {Promise<string>}
     * @memberof WindowsStorePythonProcess
     */
    public async getExecutablePath(): Promise<string> {
        return this.windowsStoreInterpreter.isWindowsStoreInterpreter(this.pythonPath)
            ? this.pythonPath
            : super.getExecutablePath();
    }
}
