// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { CancellationToken } from 'vscode-jsonrpc';
import { IApplicationShell } from '../../../common/application/types';
import { traceInfo, traceVerbose, traceError } from '../../../common/logger';
import { IInstaller, Product } from '../../../common/types';
import { PythonInterpreter, IInterpreterService } from '../../../interpreter/contracts';
import { IJupyterKernelSpec, IJupyterSessionManager } from '../../types';
import { KernelSelectionProvider } from './kernelSelections';
import { KernelService } from './kernelService';
import { nbformat } from '@jupyterlab/coreutils';

@injectable()
export class KernelSelector {
    constructor(
        @inject(KernelSelectionProvider) private readonly selectionProvider: KernelSelectionProvider,
        @inject(IApplicationShell) private readonly applicationShell: IApplicationShell,
        @inject(KernelService) private readonly kernelService: KernelService,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
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
        const suggestions = await this.selectionProvider.getKernelSelectionsForLocalSession(session, cancelToken);
        const selection = await this.applicationShell.showQuickPick(suggestions, undefined, cancelToken);
        if (!selection) {
            return;
        }

        // Check if ipykernel is installed in this kernel.
        if (selection.selection.interpreter) {
            return this.userInterpreterAsKernel(selection.selection.interpreter, session, cancelToken);
        } else {
            return selection.selection.kernelSpec;
        }
    }
    /**
     * Gets a kernel that needs to be used with a local session.
     * (will attempt to find the best matching kernel, or prompt user to use current interpreter or select one).
     *
     * @param {IJupyterSessionManager} sessionManager
     * @param {nbformat.INotebookMetadata} [notebookMetadata]
     * @param {CancellationToken} [cancelToken]
     * @returns {(Promise<IJupyterKernelSpec | undefined>)}
     * @memberof KernelSelector
     */
    public async getKernelForLocalConnection(sessionManager: IJupyterSessionManager, notebookMetadata?: nbformat.INotebookMetadata, cancelToken?: CancellationToken): Promise<IJupyterKernelSpec | undefined> {
        let kernelSpec: IJupyterKernelSpec | undefined;
        if (notebookMetadata?.kernelspec){
            kernelSpec = await this.kernelService.findMatchingKernelSpec(notebookMetadata?.kernelspec, sessionManager, cancelToken);
            if (!kernelSpec){
                // No kernel info, hence prmopt to use current interpreter as a kernel.
                const activeInterpreter = await this.interpreterService.getActiveInterpreter(undefined);
                if (activeInterpreter){
                    kernelSpec = await this.useInterpreterOrSelectLocalKernel(`Kernel ${notebookMetadata.kernelspec.display_name} could not be found.`, activeInterpreter, sessionManager, cancelToken);
                } else {
                    kernelSpec = await this.selectLocalKernel(sessionManager, cancelToken);
                }
            }
        } else {
            // No kernel info, hence use current interpreter as a kernel.
            const activeInterpreter = await this.interpreterService.getActiveInterpreter(undefined);
            if (activeInterpreter) {
                kernelSpec = await this.kernelService.searchAndRegisterKernel(activeInterpreter, cancelToken);
            }
        }

        // If still not found, log an error (this seems possible for some people, so use the default)
        if (!kernelSpec) {
            traceError('Jupyter Kernel Spec not found for a local connection');
        }

        return kernelSpec;
    }

    private async useInterpreterOrSelectLocalKernel(message: string, interpreter: PythonInterpreter, session?: IJupyterSessionManager, cancelToken?: CancellationToken): Promise<IJupyterKernelSpec | undefined> {
        // tslint:disable-next-line: messages-must-be-localized
        const selection = await this.applicationShell.showInformationMessage(message, 'Use current interpreter', 'Select Kernel');
        switch (selection) {
            case 'Use current interpreter':
                return this.userInterpreterAsKernel(interpreter, session, cancelToken);
            case 'Select Kernel':
                return this.selectLocalKernel(session, cancelToken);
            default:
                return;
        }
    }
    private async userInterpreterAsKernel(interpreter: PythonInterpreter, session?: IJupyterSessionManager, cancelToken?: CancellationToken): Promise<IJupyterKernelSpec | undefined> {
        if (await this.installer.isInstalled(Product.ipykernel, interpreter)) {
            // Find the kernel associated with this interpter.
            const kernelSpec = await this.kernelService.findMatchingKernelSpec(interpreter, session, cancelToken);
            if (kernelSpec){
                traceVerbose(`ipykernel installed in ${interpreter.path}, and matching found.`);
                return kernelSpec;
            }
            traceInfo(`ipykernel installed in ${interpreter.path}, no matching kernel found. Will register kernel.`);
        }

        // Try an install this interpreter as a kernel.
        return this.kernelService.registerKernel(interpreter, cancelToken);
    }
}
