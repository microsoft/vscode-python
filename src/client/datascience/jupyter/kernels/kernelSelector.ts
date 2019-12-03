// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { CancellationToken } from 'vscode-jsonrpc';
import { IApplicationShell } from '../../../common/application/types';
import { traceWarning } from '../../../common/logger';
import { IInstaller, InstallerResponse, Product } from '../../../common/types';
import { PythonInterpreter } from '../../../interpreter/contracts';
import { JupyterCommands } from '../../constants';
import { IJupyterCommand, IJupyterKernelSpec, IJupyterSessionManager } from '../../types';
import { JupyterCommandFinder, ModuleExistsStatus } from '../jupyterCommandFinder';
import { KernelSelectionProviderFactory } from './kernelSelections';
import { KernelService } from './kernelService';

@injectable()
export class KernelSelector {
    constructor(
        @inject(KernelSelectionProviderFactory) private readonly providerFactory: KernelSelectionProviderFactory,
        @inject(IApplicationShell) private readonly applicationShell: IApplicationShell,
        @inject(JupyterCommandFinder) private readonly cmdFinder: JupyterCommandFinder,
        @inject(KernelService) private readonly kernelService: KernelService,
        @inject(IInstaller) private readonly installer: IInstaller
    ) {}
    public async selectKernel(
        options: { session?: IJupyterSessionManager } | { session: IJupyterSessionManager; isRemoteConnection: true },
        cancelToken?: CancellationToken
    ): Promise<IJupyterKernelSpec | undefined> {
        const provider =
            'isRemoteConnection' in options
                ? this.providerFactory.getRemoteKernelSelectionProvider(options.session)
                : this.providerFactory.getLocalKernelSelectionProvider(options.session);

        const suggestions = (await provider).getKernelSelections(cancelToken);
        const selection = await this.applicationShell.showQuickPick(suggestions);

        if (!selection) {
            return;
        }

        // Nothing to validate if this is a remote connection.
        if ('isRemoteConnection' in options) {
            if ('kernelSpec' in selection.selection) {
                return selection.selection.kernelSpec;
            }
            // This is not possible.
            throw new Error('Invalid Selection in kernel spec');
        }

        // Check if ipykernel is installed in this kernel.
        if ('interpreter' in selection.selection) {
            const interpreter = selection.selection.interpreter;
            const isValid = await this.isSelectionValid(interpreter, cancelToken);
            if (!isValid) {
                return;
            }

            // Try an install this interpreter as a kernel.
            return this.kernelService.registerKernel(interpreter, cancelToken);
        } else {
            return selection.selection.kernelSpec;
        }
    }

    private async isSelectionValid(interpreter: PythonInterpreter, cancelToken?: CancellationToken): Promise<boolean> {
        // Do we have the ability to install kernels.
        const specCmd = await this.getCreateCmd(cancelToken);
        if (!specCmd) {
            traceWarning('JupyterCommand not available to install a kernel');
            return false;
        }
        // Is ipykernel installed in this environment.
        if (!(await this.installer.isInstalled(Product.ipykernel, interpreter))) {
            const response = await this.installer.promptToInstall(Product.ipykernel, interpreter);
            if (response !== InstallerResponse.Installed) {
                traceWarning(`ipykernel not installed in the interpreter ${interpreter.path}`);
                return false;
            }
        }
        return true;
    }
    private async getCreateCmd(cancelToken?: CancellationToken): Promise<IJupyterCommand | undefined> {
        const specCmd = await this.cmdFinder.findBestCommand(JupyterCommands.KernelCreateCommand, cancelToken);
        if (specCmd.status === ModuleExistsStatus.NotFound) {
            //this.applicationShell.showInformationMessage('Install?');
        }
        if (specCmd.command) {
            return specCmd.command;
        }
    }
}
