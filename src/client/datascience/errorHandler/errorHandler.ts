// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable } from 'inversify';
import { IApplicationShell } from '../../common/application/types';
import { IInstallationChannelManager } from '../../common/installer/types';
import { ILogger, Product } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { IServiceContainer } from '../../ioc/types';
import { JupyterInstallError } from '../jupyter/jupyterInstallError';
import { JupyterSelfCertsError } from '../jupyter/jupyterSelfCertsError';
import { IDataScienceErrorHandler } from '../types';

@injectable()
export class DataScienceErrorHandler implements IDataScienceErrorHandler {
    constructor(@inject(IApplicationShell) private applicationShell: IApplicationShell,
        @inject(ILogger) private logger: ILogger,
        @inject(IServiceContainer) protected serviceContainer: IServiceContainer) {
    }

    public handleError(err: Error) {
        if (err instanceof JupyterInstallError) {
            this.applicationShell.showInformationMessage(
                localize.DataScience.jupyterNotSupported(),
                localize.DataScience.jupyterInstall(),
                localize.DataScience.notebookCheckForImportNo())
                .then(response => {
                    if (response === localize.DataScience.jupyterInstall()) {
                        const channels = this.serviceContainer.get<IInstallationChannelManager>(IInstallationChannelManager);
                        return channels.getInstallationChannel(Product.jupyter);
                    } else {
                        const jupyterError = err as JupyterInstallError;

                        // This is a special error that shows a link to open for more help
                        this.applicationShell.showErrorMessage(jupyterError.message, jupyterError.actionTitle).then(v => {
                            // User clicked on the link, open it.
                            if (v === jupyterError.actionTitle) {
                                this.applicationShell.openUrl(jupyterError.action);
                            }
                        });
                    }
                }).then(installer => {
                    if (installer) {
                        installer.installModule('jupyter')
                            .catch(e => this.applicationShell.showErrorMessage(e.message, localize.DataScience.pythonInteractiveHelpLink()));
                    }
                });
        } else if (err instanceof JupyterSelfCertsError) {
            // Don't show the message for self cert errors
            noop();
        } else if (err.message) {
            this.applicationShell.showErrorMessage(err.message);
        } else {
            this.applicationShell.showErrorMessage(err.toString());
        }
        this.logger.logError(err);
    }
}
