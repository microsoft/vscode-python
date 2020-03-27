// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ProgressLocation, ProgressOptions } from 'vscode';
import { IApplicationShell } from '../../../common/application/types';
import { IConfigurationService, Resource } from '../../../common/types';
import { Common, DataScience } from '../../../common/utils/localize';
import { StopWatch } from '../../../common/utils/stopWatch';
import { Commands, Settings } from '../../constants';
import { IConnection, IJupyterKernelSpec, IJupyterSessionManagerFactory, INotebook } from '../../types';
import { JupyterInvalidKernelError } from '../jupyterInvalidKernelError';
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

    public async askForLocalKernel(
        resource: Resource,
        kernelSpec: IJupyterKernelSpec | LiveKernelModel | undefined
    ): Promise<KernelSpecInterpreter | undefined> {
        const displayName = kernelSpec?.display_name || kernelSpec?.name || '';
        const message = DataScience.sessionStartFailedWithKernel().format(displayName, Commands.ViewJupyterOutput);
        const selectKernel = DataScience.selectDifferentKernel();
        const cancel = Common.cancel();
        const selection = await this.appShell.showErrorMessage(message, selectKernel, cancel);
        if (selection === selectKernel) {
            return this.selectLocalJupyterKernel(resource, kernelSpec);
        }
    }

    private async selectJupyterKernel(notebook: INotebook): Promise<KernelSpecInterpreter | undefined> {
        let kernel: KernelSpecInterpreter | undefined;

        const settings = this.configService.getSettings(notebook.resource);
        const isLocalConnection =
            notebook.server.getConnectionInfo()?.localLaunch ??
            settings.datascience.jupyterServerURI.toLowerCase() === Settings.JupyterServerLocalLaunch;

        if (isLocalConnection) {
            kernel = await this.selectLocalJupyterKernel(notebook.resource, notebook?.getKernelSpec());
        } else if (notebook) {
            const connInfo = notebook.server.getConnectionInfo();
            const currentKernel = notebook.getKernelSpec();
            if (connInfo) {
                kernel = await this.selectRemoteJupyterKernel(notebook.resource, connInfo, currentKernel);
            }
        }
        return kernel;
    }

    private async selectLocalJupyterKernel(
        resource: Resource,
        currentKernel?: IJupyterKernelSpec | LiveKernelModel
    ): Promise<KernelSpecInterpreter> {
        return this.kernelSelector.selectLocalKernel(resource, new StopWatch(), undefined, undefined, currentKernel);
    }

    private async selectRemoteJupyterKernel(
        resource: Resource,
        connInfo: IConnection,
        currentKernel?: IJupyterKernelSpec | LiveKernelModel
    ): Promise<KernelSpecInterpreter> {
        const stopWatch = new StopWatch();
        const session = await this.jupyterSessionManagerFactory.create(connInfo);
        return this.kernelSelector.selectRemoteKernel(resource, stopWatch, session, undefined, currentKernel);
    }
    private async switchKernelWithRetry(notebook: INotebook, kernel: KernelSpecInterpreter): Promise<void> {
        const settings = this.configService.getSettings(notebook.resource);
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
                if (
                    isLocalConnection &&
                    (ex instanceof JupyterSessionStartError || ex instanceof JupyterInvalidKernelError)
                ) {
                    // Looks like we were unable to start a session for the local connection.
                    // Possibly something wrong with the kernel.
                    // At this point we have a valid jupyter server.
                    const potential = await this.askForLocalKernel(
                        notebook.resource,
                        kernel.kernelSpec || kernel.kernelModel
                    );
                    if (potential && Object.keys(potential).length > 0) {
                        kernel = potential;
                        continue;
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
                this.configService.getSettings(notebook.resource).datascience.jupyterLaunchTimeout
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
            title: DataScience.switchingKernelProgress().format(displayName),
        };
        await this.appShell.withProgress(options, async (_, __) => switchKernel(kernel!));
    }
}
