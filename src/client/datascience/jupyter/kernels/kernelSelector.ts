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
import { KernelSelectionProvider } from './kernelSelections';
import { KernelService } from './kernelService';
import { IKernelSelector } from './types';

@injectable()
export class KernelSelector implements IKernelSelector {
    constructor(
        @inject(KernelSelectionProvider) private readonly selectionProvider: KernelSelectionProvider,
        @inject(IApplicationShell) private readonly applicationShell: IApplicationShell,
        @inject(JupyterCommandFinder) private readonly cmdFinder: JupyterCommandFinder,
        @inject(KernelService) private readonly kernelService: KernelService,
        @inject(IInstaller) private readonly installer: IInstaller
    ) {}
    public async selectRemoteKernel(session: IJupyterSessionManager, cancelToken?: CancellationToken): Promise<IJupyterKernelSpec | undefined> {
        const suggestions = this.selectionProvider.getKernelSelectionsForRemoteSession(session, cancelToken);
        const selection = await this.applicationShell.showQuickPick(suggestions, undefined, cancelToken);
        if (!selection) {
            return;
        }

        // Nothing to validate if this is a remote connection.
        if (!selection.selection.kernelSpec) {
            return selection.selection.kernelSpec;
        }
        // This is not possible (remote kernels selector can only display remote kernels).
        throw new Error('Invalid Selection in kernel spec (somehow a local kernel/interpreter has been selected for a remote session!');
    }

    public async selectLocalKernel(session?: IJupyterSessionManager, cancelToken?: CancellationToken): Promise<IJupyterKernelSpec | undefined> {
        const suggestions = this.selectionProvider.getLocalKernelSelectionProvider(session, cancelToken);
        const selection = await this.applicationShell.showQuickPick(suggestions, undefined, cancelToken);
        if (!selection) {
            return;
        }

        // Check if ipykernel is installed in this kernel.
        if (selection.selection.interpreter) {
            const isValid = await this.isSelectionValid(selection.selection.interpreter, cancelToken);
            if (!isValid) {
                return;
            }

            // Try an install this interpreter as a kernel.
            return this.kernelService.registerKernel(selection.selection.interpreter, cancelToken);
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
