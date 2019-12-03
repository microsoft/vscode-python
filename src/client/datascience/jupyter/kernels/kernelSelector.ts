// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { CancellationToken } from 'vscode-jsonrpc';
import { IApplicationShell } from '../../../common/application/types';
import { Cancellation } from '../../../common/cancellation';
import { traceInfo, traceWarning } from '../../../common/logger';
import { IInstaller, InstallerResponse, Product } from '../../../common/types';
import { PythonInterpreter } from '../../../interpreter/contracts';
import { IJupyterKernelSpec, IJupyterSessionManager } from '../../types';
import { KernelSelectionProvider } from './kernelSelections';
import { KernelService } from './kernelService';

@injectable()
export class KernelSelector {
    constructor(
        @inject(KernelSelectionProvider) private readonly selectionProvider: KernelSelectionProvider,
        @inject(IApplicationShell) private readonly applicationShell: IApplicationShell,
        @inject(KernelService) private readonly kernelService: KernelService,
        @inject(IInstaller) private readonly installer: IInstaller
    ) {}
    public async selectRemoteKernel(session: IJupyterSessionManager, cancelToken?: CancellationToken): Promise<IJupyterKernelSpec | undefined> {
        const suggestions = this.selectionProvider.getKernelSelectionsForRemoteSession(session, cancelToken);
        const selection = await this.applicationShell.showQuickPick(suggestions, undefined, cancelToken);
        if (!selection) {
            return;
        }

        if (selection.selection.kernelSpec) {
            return selection.selection.kernelSpec;
        }
        // This is not possible (remote kernels selector can only display remote kernels).
        throw new Error('Invalid Selection in kernel spec (somehow a local kernel/interpreter has been selected for a remote session!');
    }

    public async selectLocalKernel(session?: IJupyterSessionManager, cancelToken?: CancellationToken): Promise<IJupyterKernelSpec | undefined> {
        const suggestions = this.selectionProvider.getKernelSelectionsForLocalSession(session, cancelToken);
        const selection = await this.applicationShell.showQuickPick(suggestions, undefined, cancelToken);
        if (!selection) {
            return;
        }

        // Check if ipykernel is installed in this kernel.
        const interpreter = selection.selection.interpreter;
        if (interpreter) {
            const isValid = await this.isSelectionValid(interpreter, cancelToken);
            if (isValid) {
                // Find the kernel associated with this interpter.
                const kernelSpec = await this.kernelService.findMatchingKernelSpec(interpreter, session, cancelToken);
                if (kernelSpec){
                    traceInfo(`ipykernel installed in ${interpreter.path}, and matching found.`);
                    return kernelSpec;
                }
                traceInfo(`ipykernel installed in ${interpreter.path}, no matching kernel found. Will register kernel.`);
            }

            // Try an install this interpreter as a kernel.
            return this.kernelService.registerKernel(interpreter, cancelToken);
        } else {
            return selection.selection.kernelSpec;
        }
    }

    private async isSelectionValid(interpreter: PythonInterpreter, cancelToken?: CancellationToken): Promise<boolean> {
        // Is ipykernel installed in this environment.
        if (await this.installer.isInstalled(Product.ipykernel, interpreter)) {
            return true;
        }
        if (Cancellation.isCanceled(cancelToken)) {
            return false;
        }
        const response = await this.installer.promptToInstall(Product.ipykernel, interpreter);
        if (response === InstallerResponse.Installed) {
            return true;
        }
        traceWarning(`Prompted to install ipykernel, however ipykernel not installed in the interpreter ${interpreter.path}`);
        return false;
    }
}
