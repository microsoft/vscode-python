// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { IApplicationShell } from '../../common/application/types';
import { IFileSystem } from '../../common/platform/types';
import { IPythonExecutionFactory } from '../../common/process/types';
import { IServiceContainer } from '../../ioc/types';
import { IConfigurationProviderUtils } from './types';

const PSERVE_SCRIPT_FILE_NAME = 'pserve.py';

@injectable()
export class ConfigurationProviderUtils implements IConfigurationProviderUtils {
    private readonly executionFactory: IPythonExecutionFactory;
    private readonly fs: IFileSystem;
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.executionFactory = this.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory);
        this.fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
    }
    public async getPyramidStartupScriptFilePath(resource?: Uri): Promise<string | undefined> {
        try {
            const executionService = await this.executionFactory.create({ resource });
            const output = await executionService.exec(['-c', 'import pyramid;print(pyramid.__file__)'], { throwOnStdErr: true });
            const pserveFilePath = path.join(path.dirname(output.stdout.trim()), 'scripts', PSERVE_SCRIPT_FILE_NAME);
            return await this.fs.fileExists(pserveFilePath) ? pserveFilePath : undefined;
        } catch (ex) {
            const message = 'Unable to locate \'pserve.py\' required for debugging of Pyramid applications.';
            console.error(message, ex);
            const app = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
            app.showErrorMessage(message);
            return;
        }
    }
}
