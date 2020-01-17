// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable } from 'inversify';
import { IApplicationShell } from '../../common/application/types';
import { traceError } from '../../common/logger';
import { noop } from '../../common/utils/misc';
import { JupyterInstallError } from '../jupyter/jupyterInstallError';
import { JupyterSelfCertsError } from '../jupyter/jupyterSelfCertsError';
import { IDataScienceErrorHandler, IJupyterInterpreterDependencyManager } from '../types';

@injectable()
export class DataScienceErrorHandler implements IDataScienceErrorHandler {
    constructor(
        @inject(IApplicationShell) private applicationShell: IApplicationShell,
        @inject(IJupyterInterpreterDependencyManager) protected dependencyManager: IJupyterInterpreterDependencyManager
    ) {}

    public async handleError(err: Error): Promise<void> {
        if (err instanceof JupyterInstallError) {
            await this.dependencyManager.installMissingDependencies(err);
        } else if (err instanceof JupyterSelfCertsError) {
            // Don't show the message for self cert errors
            noop();
        } else if (err.message) {
            this.applicationShell.showErrorMessage(err.message);
        } else {
            this.applicationShell.showErrorMessage(err.toString());
        }
        traceError('DataScience Error', err);
    }
}
