// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { IApplicationShell } from '../../../common/application/types';
import { traceError } from '../../../common/logger';
import { IFileSystem } from '../../../common/platform/types';
import { IPythonExecutionFactory } from '../../../common/process/types';
import { noop } from '../../../common/utils/misc';
import { IConfigurationProviderUtils } from './types';

const PSERVE_SCRIPT_FILE_NAME = 'pserve.py';

@injectable()
export class ConfigurationProviderUtils implements IConfigurationProviderUtils {
    constructor(@inject(IPythonExecutionFactory) private readonly executionFactory: IPythonExecutionFactory,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(IApplicationShell) private readonly shell: IApplicationShell) {
    }
    public async getPyramidStartupScriptFilePath(resource?: Uri): Promise<string | undefined> {
        try {
            const executionService = await this.executionFactory.create({ resource });
            const output = await executionService.exec(['-c', 'import pyramid;print(pyramid.__file__)'], { throwOnStdErr: true });
            const pserveFilePath = path.join(path.dirname(output.stdout.trim()), 'scripts', PSERVE_SCRIPT_FILE_NAME);
            return await this.fs.fileExists(pserveFilePath) ? pserveFilePath : undefined;
        } catch (ex) {
            const message = 'Unable to locate \'pserve.py\' required for debugging of Pyramid applications.';
            traceError(message, ex);
            this.shell.showErrorMessage(message).then(noop, noop);
            return;
        }
    }
}
