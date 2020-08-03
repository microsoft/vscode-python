// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import type { Session } from '@jupyterlab/services';
import { CancellationToken, QuickPickItem } from 'vscode';
import { Resource } from '../../../common/types';
import { PythonInterpreter } from '../../../pythonEnvironments/info';
import { IJupyterKernel, IJupyterKernelSpec, IJupyterSessionManager } from '../../types';
import { KernelSpecInterpreter } from './kernelSelector';

export type LiveKernelModel = IJupyterKernel & Partial<IJupyterKernelSpec> & { session: Session.IModel };

/**
 * Whether a selected kernel is:
 * - Kernel spec (IJupyterKernelSpec)
 * - Active kernel (IJupyterKernel) or
 * - An Interpreter
 */
export type KernelSelection =
    | { kernelModel: LiveKernelModel; kernelSpec: undefined; interpreter: undefined }
    | { kernelModel: undefined; kernelSpec: IJupyterKernelSpec; interpreter: undefined }
    | { kernelModel: undefined; kernelSpec: undefined; interpreter: PythonInterpreter };

export interface IKernelSpecQuickPickItem extends QuickPickItem {
    selection: KernelSelection;
}

export interface IKernelSelectionListProvider {
    getKernelSelections(resource: Resource, cancelToken?: CancellationToken): Promise<IKernelSpecQuickPickItem[]>;
}

export interface IKernelSelectionUsage {
    /**
     * Given a kernel selection, this method will attempt to use that kernel and return the corresponding Interpreter, Kernel Spec and the like.
     * This method will also check if required dependencies are installed or not, and will install them if required.
     */
    useSelectedKernel(
        selection: KernelSelection,
        resource: Resource,
        type: 'raw' | 'jupyter' | 'noConnection',
        session?: IJupyterSessionManager,
        cancelToken?: CancellationToken
    ): Promise<KernelSpecInterpreter | {}>;
}
