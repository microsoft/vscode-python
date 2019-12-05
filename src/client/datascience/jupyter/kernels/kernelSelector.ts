// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { CancellationToken } from 'vscode-jsonrpc';
import { IApplicationShell } from '../../../common/application/types';
import { traceInfo, traceVerbose } from '../../../common/logger';
import { IInstaller, Product } from '../../../common/types';
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
    public async useInterpreterOrSelectLocalKernel(message: string, interpreter: PythonInterpreter, session?: IJupyterSessionManager, cancelToken?: CancellationToken): Promise<IJupyterKernelSpec | undefined> {
        // tslint:disable-next-line: messages-must-be-localized
        const selection = this.applicationShell.showInformationMessage(message, 'Use current interpreter', 'Select Kernel');
        switch (selection) {
            case 'Use current interpreter':
                return this.userInterpreterAsKernel(interpreter, session, cancelToken);
            case 'Select Kernel':
                return this.selectLocalKernel(session, cancelToken);
            default:
                return;
        }
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
