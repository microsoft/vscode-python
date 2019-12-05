// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { nbformat } from '@jupyterlab/coreutils';
import { inject, injectable } from 'inversify';
import { CancellationToken } from 'vscode-jsonrpc';
import { IApplicationShell } from '../../../common/application/types';
import { traceError, traceInfo, traceVerbose } from '../../../common/logger';
import { IInstaller, Product } from '../../../common/types';
import { IInterpreterService, PythonInterpreter } from '../../../interpreter/contracts';
import { IJupyterKernelSpec, IJupyterSessionManager } from '../../types';
import { KernelSelectionProvider } from './kernelSelections';
import { KernelService } from './kernelService';

export type KernelSpecInterpreter = {
    kernelSpec?: IJupyterKernelSpec;
    /**
     * Interpreter that goes with the kernelspec.
     * Sometimes, we're unable to determine the exact interpreter associalted with a kernelspec, in such cases this is a closes match.
     * E.g. when selecting a remote kernel, we do not have the remote interpreter information, we can only try to find a close match.
     *
     * @type {PythonInterpreter}
     */
    interpreter?: PythonInterpreter;
};

@injectable()
export class KernelSelector {
    constructor(
        @inject(KernelSelectionProvider) private readonly selectionProvider: KernelSelectionProvider,
        @inject(IApplicationShell) private readonly applicationShell: IApplicationShell,
        @inject(KernelService) private readonly kernelService: KernelService,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IInstaller) private readonly installer: IInstaller
    ) {}
    /**
     * Selects a kernel from a remote session.
     *
     * @param {IJupyterSessionManager} session
     * @param {CancellationToken} [cancelToken]
     * @returns {Promise<KernelSpecInterpreter>}
     * @memberof KernelSelector
     */
    public async selectRemoteKernel(session: IJupyterSessionManager, cancelToken?: CancellationToken): Promise<KernelSpecInterpreter> {
        const suggestions = this.selectionProvider.getKernelSelectionsForRemoteSession(session, cancelToken);
        const selection = await this.applicationShell.showQuickPick(suggestions, undefined, cancelToken);
        if (!selection) {
            return {};
        }

        if (selection.selection.kernelSpec) {
            const interpreter = await this.kernelService.findMatchingInterpreter(selection.selection.kernelSpec, cancelToken);
            return {kernelSpec: selection.selection.kernelSpec, interpreter};
        }
        // This is not possible (remote kernels selector can only display remote kernels).
        throw new Error('Invalid Selection in kernel spec (somehow a local kernel/interpreter has been selected for a remote session!');
    }
    /**
     * Select a kernel from a local session.
     *
     * @param {IJupyterSessionManager} [session]
     * @param {CancellationToken} [cancelToken]
     * @returns {Promise<KernelSpecInterpreter>}
     * @memberof KernelSelector
     */
    public async selectLocalKernel(session?: IJupyterSessionManager, cancelToken?: CancellationToken): Promise<KernelSpecInterpreter> {
        const suggestions = await this.selectionProvider.getKernelSelectionsForLocalSession(session, cancelToken);
        const selection = await this.applicationShell.showQuickPick(suggestions, undefined, cancelToken);
        if (!selection) {
            return {};
        }
        // Check if ipykernel is installed in this kernel.
        if (selection.selection.interpreter) {
            return this.userInterpreterAsKernel(selection.selection.interpreter, session, cancelToken);
        } else {
            const interpreter = selection.selection.kernelSpec ? await this.kernelService.findMatchingInterpreter(selection.selection.kernelSpec, cancelToken) : undefined;
            return {kernelSpec: selection.selection.kernelSpec, interpreter};
        }
    }
    /**
     * Gets a kernel that needs to be used with a local session.
     * (will attempt to find the best matching kernel, or prompt user to use current interpreter or select one).
     *
     * @param {IJupyterSessionManager} [sessionManager]
     * @param {nbformat.INotebookMetadata} [notebookMetadata]
     * @param {CancellationToken} [cancelToken]
     * @returns {Promise<KernelSpecInterpreter>}
     * @memberof KernelSelector
     */
    public async getKernelForLocalConnection(sessionManager?: IJupyterSessionManager, notebookMetadata?: nbformat.INotebookMetadata, cancelToken?: CancellationToken): Promise<KernelSpecInterpreter> {
        let selection: KernelSpecInterpreter = {};
        if (notebookMetadata?.kernelspec){
            selection.kernelSpec = await this.kernelService.findMatchingKernelSpec(notebookMetadata?.kernelspec, sessionManager, cancelToken);
            if (selection.kernelSpec){
                selection.interpreter = await this.kernelService.findMatchingInterpreter(selection.kernelSpec);
            } else {
                // No kernel info, hence prmopt to use current interpreter as a kernel.
                const activeInterpreter = await this.interpreterService.getActiveInterpreter(undefined);
                if (activeInterpreter) {
                    selection = await this.useInterpreterOrSelectLocalKernel(`Kernel ${notebookMetadata.kernelspec.display_name} could not be found.`, activeInterpreter, sessionManager, cancelToken);
                } else {
                    selection = await this.selectLocalKernel(sessionManager, cancelToken);
                }
            }
        } else {
            // No kernel info, hence use current interpreter as a kernel.
            const activeInterpreter = await this.interpreterService.getActiveInterpreter(undefined);
            if (activeInterpreter) {
                selection.interpreter = activeInterpreter;
                selection.kernelSpec = await this.kernelService.searchAndRegisterKernel(activeInterpreter, cancelToken);
            }
        }
        // If still not found, log an error (this seems possible for some people, so use the default)
        if (!selection.kernelSpec) {
            traceError('Jupyter Kernel Spec not found for a local connection');
        }
        return selection;
    }

    private async useInterpreterOrSelectLocalKernel(message: string, interpreter: PythonInterpreter, session?: IJupyterSessionManager, cancelToken?: CancellationToken): Promise<KernelSpecInterpreter> {
        // tslint:disable-next-line: messages-must-be-localized
        const selection = await this.applicationShell.showInformationMessage(message, 'Use current interpreter', 'Select Kernel');
        switch (selection) {
            case 'Use current interpreter':
                return this.userInterpreterAsKernel(interpreter, session, cancelToken);
            case 'Select Kernel':
                return this.selectLocalKernel(session, cancelToken);
            default:
                return {};
        }
    }
    private async userInterpreterAsKernel(interpreter: PythonInterpreter, session?: IJupyterSessionManager, cancelToken?: CancellationToken): Promise<KernelSpecInterpreter> {
        let kernelSpec: IJupyterKernelSpec | undefined;
        if (await this.installer.isInstalled(Product.ipykernel, interpreter)) {
            // Find the kernel associated with this interpter.
            kernelSpec = await this.kernelService.findMatchingKernelSpec(interpreter, session, cancelToken);
            if (kernelSpec){
                traceVerbose(`ipykernel installed in ${interpreter.path}, and matching found.`);
                return { kernelSpec, interpreter };
            }
            traceInfo(`ipykernel installed in ${interpreter.path}, no matching kernel found. Will register kernel.`);
        }
        // Try an install this interpreter as a kernel.
        kernelSpec = await this.kernelService.registerKernel(interpreter, cancelToken);
        return { kernelSpec, interpreter };
    }
}
