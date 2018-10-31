// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';

import { IPythonExecutionFactory } from '../common/process/types';
import { ILogger } from '../common/types';
import { IJupyterAvailability } from './types';

@injectable()
export class JupyterAvailability implements IJupyterAvailability {

    constructor(
        @inject(IPythonExecutionFactory) private executionFactory: IPythonExecutionFactory,
        @inject(ILogger) private logger : ILogger) {

    }

    public isNotebookSupported = async (): Promise<boolean> => {
        // Spawn jupyter notebook --version and see if it returns something
        try {
            const pythonService = await this.executionFactory.create({});
            const result = await pythonService.execModule('jupyter', ['notebook', '--version'], { throwOnStdErr: true, encoding: 'utf8' });
            return (!result.stderr);
        } catch (err) {
            this.logger.logWarning(err);
            return false;
        }
    }

    public isImportSupported = async (): Promise<boolean> => {
        // Spawn jupyter nbconvert --version and see if it returns something
        try {
            const pythonService = await this.executionFactory.create({});
            const result = await pythonService.execModule('jupyter', ['nbconvert', '--version'], { throwOnStdErr: true, encoding: 'utf8' });
            return (!result.stderr);
        } catch (err) {
            this.logger.logWarning(err);
            return false;
        }
    }
}
