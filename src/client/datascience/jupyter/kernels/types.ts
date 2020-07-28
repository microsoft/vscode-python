// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import type { Session } from '@jupyterlab/services';
import { CancellationToken, QuickPickItem } from 'vscode';
import { Resource } from '../../../common/types';
import { PythonInterpreter } from '../../../pythonEnvironments/info';
import { IJupyterKernel, IJupyterKernelSpec } from '../../types';

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
