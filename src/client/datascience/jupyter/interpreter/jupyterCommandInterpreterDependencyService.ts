// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IApplicationShell } from '../../../common/application/types';
import { ProductNames } from '../../../common/installer/productNames';
import { IInstallationChannelManager } from '../../../common/installer/types';
import { Product } from '../../../common/types';
import { DataScience } from '../../../common/utils/localize';
import { sendTelemetryEvent } from '../../../telemetry';
import { Telemetry } from '../../constants';
import { IJupyterInterpreterDependencyManager } from '../../types';
import { JupyterInstallError } from '../jupyterInstallError';

@injectable()
export class JupyterCommandInterpreterDependencyService implements IJupyterInterpreterDependencyManager {
    constructor(
        @inject(IApplicationShell) private applicationShell: IApplicationShell,
        @inject(IInstallationChannelManager) protected channels: IInstallationChannelManager
    ) {}
    public async installMissingDependencies(err?: JupyterInstallError): Promise<void> {
        if (!err) {
            return;
        }
        sendTelemetryEvent(Telemetry.JupyterNotInstalledErrorShown);
        const response = await this.applicationShell.showInformationMessage(
            err.message,
            DataScience.jupyterInstall(),
            DataScience.notebookCheckForImportNo(),
            err.actionTitle
        );
        if (response === DataScience.jupyterInstall()) {
            const installers = await this.channels.getInstallationChannels();
            if (installers) {
                // If Conda is available, always pick it as the user must have a Conda Environment
                const installer = installers.find(ins => ins.name === 'Conda');
                const product = ProductNames.get(Product.jupyter);

                if (installer && product) {
                    sendTelemetryEvent(Telemetry.UserInstalledJupyter);
                    installer
                        .installModule(product)
                        .catch(e =>
                            this.applicationShell.showErrorMessage(e.message, DataScience.pythonInteractiveHelpLink())
                        );
                } else if (installers[0] && product) {
                    installers[0]
                        .installModule(product)
                        .catch(e =>
                            this.applicationShell.showErrorMessage(e.message, DataScience.pythonInteractiveHelpLink())
                        );
                }
            }
        } else if (response === DataScience.notebookCheckForImportNo()) {
            sendTelemetryEvent(Telemetry.UserDidNotInstallJupyter);
        } else if (response === err.actionTitle) {
            // This is a special error that shows a link to open for more help
            this.applicationShell.openUrl(err.action);
        }
    }
}
