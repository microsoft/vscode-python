// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ProgressLocation, ProgressOptions } from 'vscode';
import { IApplicationShell } from '../../../common/application/types';
import { IConfigurationService } from '../../../common/types';
import { Common, DataScience } from '../../../common/utils/localize';
import { captureTelemetry } from '../../../telemetry';
import { Commands, Settings, Telemetry } from '../../constants';
import { IConnection, IJupyterKernelSpec, IJupyterSessionManagerFactory, INotebook } from '../../types';
import { JupyterSessionStartError } from '../jupyterSession';
import { KernelSelector, KernelSpecInterpreter } from './kernelSelector';
import { LiveKernelModel } from './types';

@injectable()
export class KernelSwitcher {
    constructor(
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(IJupyterSessionManagerFactory) private jupyterSessionManagerFactory: IJupyterSessionManagerFactory,
        @inject(KernelSelector) private kernelSelector: KernelSelector,
        @inject(IApplicationShell) private appShell: IApplicationShell
    ) {}

    public async switchKernel(notebook: INotebook): Promise<KernelSpecInterpreter | undefined> {
        const kernel: KernelSpecInterpreter | undefined = await this.selectJupyterKernel(notebook);
        if (kernel && (kernel.kernelSpec || kernel.kernelModel)) {
            await this.switchKernelWithRetry(notebook, kernel);
            return kernel;
        }
    }
    private async selectJupyterKernel(notebook: INotebook): Promise<KernelSpecInterpreter | undefined> {
        let kernel: KernelSpecInterpreter | undefined;

        const settings = this.configService.getSettings();
        const isLocalConnection =
            notebook.server.getConnectionInfo()?.localLaunch ??
            settings.datascience.jupyterServerURI.toLowerCase() === Settings.JupyterServerLocalLaunch;

        if (isLocalConnection) {
            kernel = await this.selectLocalJupyterKernel(notebook?.getKernelSpec());
        } else if (notebook) {
            const connInfo = notebook.server.getConnectionInfo();
            const currentKernel = notebook.getKernelSpec();
            if (connInfo) {
                kernel = await this.selectRemoteJupyterKernel(connInfo, currentKernel);
            }
        }
        return kernel;
    }

    @captureTelemetry(Telemetry.SelectLocalJupyterKernel)
    private async selectLocalJupyterKernel(
        currentKernel?: IJupyterKernelSpec | LiveKernelModel
    ): Promise<KernelSpecInterpreter> {
        return this.kernelSelector.selectLocalKernel(undefined, undefined, currentKernel);
    }

    @captureTelemetry(Telemetry.SelectRemoteJupyuterKernel)
    private async selectRemoteJupyterKernel(
        connInfo: IConnection,
        currentKernel?: IJupyterKernelSpec | LiveKernelModel
    ): Promise<KernelSpecInterpreter> {
        const session = await this.jupyterSessionManagerFactory.create(connInfo);
        return this.kernelSelector.selectRemoteKernel(session, undefined, currentKernel);
    }
    private async switchKernelWithRetry(notebook: INotebook, kernel: KernelSpecInterpreter): Promise<void> {
        const settings = this.configService.getSettings();
        const isLocalConnection =
            notebook.server.getConnectionInfo()?.localLaunch ??
            settings.datascience.jupyterServerURI.toLowerCase() === Settings.JupyterServerLocalLaunch;
        if (!isLocalConnection) {
            await this.switchToKernel(notebook, kernel);
            return;
        }

        // Keep retrying, until it works or user cancels.
        // Sometimes if a bad kernel is selected, starting a session can fail.
        // In such cases we need to let the user know about this and prompt them to select another kernel.
        // tslint:disable-next-line: no-constant-condition
        while (true) {
            try {
                await this.switchToKernel(notebook, kernel);
                return;
            } catch (ex) {
                if (ex instanceof JupyterSessionStartError && isLocalConnection) {
                    // Looks like we were unable to start a session for the local connection.
                    // Possibly something wrong with the kernel.
                    // At this point we have a valid jupyter server.
                    const displayName =
                        kernel.kernelSpec?.display_name ||
                        kernel.kernelModel?.display_name ||
                        kernel.kernelSpec?.name ||
                        kernel.kernelModel?.name ||
                        '';
                    const message = DataScience.sessionStartFailedWithKernel().format(
                        displayName,
                        Commands.ViewJupyterOutput
                    );
                    const selectKernel = DataScience.selectDifferentKernel();
                    const cancel = Common.cancel();
                    const selection = await this.appShell.showErrorMessage(message, selectKernel, cancel);
                    if (selection === selectKernel) {
                        kernel = await this.selectLocalJupyterKernel(kernel.kernelSpec || kernel.kernelModel);
                        if (Object.keys(kernel).length > 0) {
                            continue;
                        }
                    }
                }
                throw ex;
            }
        }
    }
    private async switchToKernel(notebook: INotebook, kernel: KernelSpecInterpreter): Promise<void> {
        const switchKernel = async (newKernel: KernelSpecInterpreter) => {
            // Change the kernel. A status update should fire that changes our display
            await notebook.setKernelSpec(
                newKernel.kernelSpec || newKernel.kernelModel!,
                this.configService.getSettings().datascience.jupyterLaunchTimeout
            );

            if (newKernel.interpreter) {
                notebook.setInterpreter(newKernel.interpreter);
            }
        };

        const kernelDisplayName = kernel.kernelSpec?.display_name || kernel.kernelModel?.display_name;
        const kernelName = kernel.kernelSpec?.name || kernel.kernelModel?.name;
        // One of them is bound to be non-empty.
        const displayName = kernelDisplayName || kernelName || '';
        const options: ProgressOptions = {
            location: ProgressLocation.Notification,
            cancellable: false,
            title: DataScience.switchingKernelProgress().format(displayName)
        };
        await this.appShell.withProgress(options, async (_, __) => switchKernel(kernel!));
    }
}
