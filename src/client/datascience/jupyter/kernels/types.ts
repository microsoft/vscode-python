// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import type { Session } from '@jupyterlab/services';
import { CancellationToken, QuickPickItem } from 'vscode';
import { Resource } from '../../../common/types';
import { PythonInterpreter } from '../../../pythonEnvironments/discovery/types';
import { IJupyterKernel, IJupyterKernelSpec } from '../../types';

export type LiveKernelModel = IJupyterKernel & Partial<IJupyterKernelSpec> & { session: Session.IModel };

export interface IKernelSpecQuickPickItem extends QuickPickItem {
    /**
     * Whether a
     * - Kernel spec (IJupyterKernelSpec)
     * - Active kernel (IJupyterKernel) or
     * - Interpreter has been selected.
     * If interpreter is selected, then we might need to install this as a kernel to get the kernel spec.
     *
     * @type {({ kernelModel: IJupyterKernel; kernelSpec: IJupyterKernelSpec; interpreter: undefined }
     *         | { kernelModel: undefined; kernelSpec: IJupyterKernelSpec; interpreter: undefined }
     *         | { kernelModel: undefined; kernelSpec: undefined; interpreter: PythonInterpreter })}
     * @memberof IKernelSpecQuickPickItem
     */
    selection:
        | { kernelModel: LiveKernelModel; kernelSpec: undefined; interpreter: undefined }
        | { kernelModel: undefined; kernelSpec: IJupyterKernelSpec; interpreter: undefined }
        | { kernelModel: undefined; kernelSpec: undefined; interpreter: PythonInterpreter };
}

export interface IKernelSelectionListProvider {
    getKernelSelections(resource: Resource, cancelToken?: CancellationToken): Promise<IKernelSpecQuickPickItem[]>;
}
