// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable } from 'inversify';
import { IApplicationShell } from '../../common/application/types';
import { ProductNames } from '../../common/installer/productNames';
import { IInstallationChannelManager } from '../../common/installer/types';
import { ILogger, Product } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { JupyterInstallError } from '../jupyter/jupyterInstallError';
import { JupyterSelfCertsError } from '../jupyter/jupyterSelfCertsError';
import { IDataScienceErrorHandler } from '../types';

@injectable()
export class DataScienceErrorHandler implements IDataScienceErrorHandler {
    constructor(@inject(IApplicationShell) private applicationShell: IApplicationShell,
        @inject(ILogger) private logger: ILogger,
        @inject(IInstallationChannelManager) protected channels: IInstallationChannelManager) {
    }

    public async handleError(err: Error): Promise<void> {
        if (err instanceof JupyterInstallError) {
            this.applicationShell.showInformationMessage(
                localize.DataScience.jupyterNotSupported(),
                localize.DataScience.jupyterInstall(),
                localize.DataScience.notebookCheckForImportNo())
                .then(response => {
                    if (response === localize.DataScience.jupyterInstall()) {
                        return this.channels.getInstallationChannels()
                            .then(installers => {
                                if (installers) {
                                    // If Conda is available, always pick it as the user must have a Conda Environment
                                    const installer = installers.find(ins => ins.name === 'Conda');
                                    const product = ProductNames.get(Product.jupyter);

                                    if (installer && product) {
                                        installer.installModule(product)
                                            .catch(e => this.applicationShell.showErrorMessage(e.message, localize.DataScience.pythonInteractiveHelpLink()));
                                    } else if (installers[0] && product) {
                                        installers[0].installModule(product)
                                            .catch(e => this.applicationShell.showErrorMessage(e.message, localize.DataScience.pythonInteractiveHelpLink()));
                                    }
                                }
                            });
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
