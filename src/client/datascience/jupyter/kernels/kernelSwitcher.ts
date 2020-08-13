// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ProgressLocation, ProgressOptions } from 'vscode';
import { IApplicationShell } from '../../../common/application/types';
import { IConfigurationService } from '../../../common/types';
import { DataScience } from '../../../common/utils/localize';
import { JupyterSessionStartError } from '../../baseJupyterSession';
import { Settings } from '../../constants';
import { RawKernelSessionStartError } from '../../raw-kernel/rawJupyterSession';
import { IKernelDependencyService, INotebook, KernelInterpreterDependencyResponse } from '../../types';
import { JupyterInvalidKernelError } from '../jupyterInvalidKernelError';
import { kernelConnectionMetadataHasKernelModel, kernelConnectionMetadataHasKernelSpec } from './helpers';
import { KernelSelector } from './kernelSelector';
import { KernelConnectionMetadata } from './types';

@injectable()
export class KernelSwitcher {
    constructor(
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(IApplicationShell) private appShell: IApplicationShell,
        @inject(IKernelDependencyService) private readonly kernelDependencyService: IKernelDependencyService,
        @inject(KernelSelector) private readonly selector: KernelSelector
    ) {}

    public async switchKernelWithRetry(notebook: INotebook, kernel: KernelConnectionMetadata): Promise<void> {
        const settings = this.configService.getSettings(notebook.resource);
        const isLocalConnection =
            notebook.connection?.localLaunch ??
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
                    (ex instanceof JupyterSessionStartError ||
                        ex instanceof JupyterInvalidKernelError ||
                        ex instanceof RawKernelSessionStartError)
                ) {
                    // Looks like we were unable to start a session for the local connection.
                    // Possibly something wrong with the kernel.
                    // At this point we have a valid jupyter server.
                    const potential = await this.selector.askForLocalKernel(
                        notebook.resource,
                        notebook.connection?.type || 'noConnection',
                        kernelConnectionMetadataHasKernelModel(kernel) ? kernel.kernelModel : kernel.kernelSpec
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
    private async switchToKernel(notebook: INotebook, kernel: KernelConnectionMetadata): Promise<void> {
        if (notebook.connection?.type === 'raw' && kernel.interpreter) {
            const response = await this.kernelDependencyService.installMissingDependencies(kernel.interpreter);
            if (response === KernelInterpreterDependencyResponse.cancel) {
                return;
            }
        }

        const switchKernel = async (newKernel: KernelConnectionMetadata) => {
            // Change the kernel. A status update should fire that changes our display
            await notebook.setKernelSpec(
                newKernel.kind === 'connectToLiveKernel' ? newKernel.kernelModel : newKernel.kernelSpec!,
                this.configService.getSettings(notebook.resource).datascience.jupyterLaunchTimeout,
                newKernel.interpreter
            );
        };

        const kernelModel = kernelConnectionMetadataHasKernelModel(kernel) ? kernel : undefined;
        const kernelSpec = kernelConnectionMetadataHasKernelSpec(kernel) ? kernel : undefined;
        const kernelName = kernelSpec?.kernelSpec?.name || kernelModel?.kernelModel?.name;
        // One of them is bound to be non-empty.
        const displayName = kernelModel?.kernelModel?.display_name || kernelName || '';
        const options: ProgressOptions = {
            location: ProgressLocation.Notification,
            cancellable: false,
            title: DataScience.switchingKernelProgress().format(displayName)
        };
        await this.appShell.withProgress(options, async (_, __) => switchKernel(kernel!));
    }
}
