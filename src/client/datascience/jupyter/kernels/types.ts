// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { CancellationToken, QuickPickItem } from 'vscode';
import { PythonInterpreter } from '../../../interpreter/contracts';
import { IJupyterKernelSpec, IJupyterSessionManager } from '../../types';

export interface IKernelSpecQuickPickItem extends QuickPickItem {
    /**
     * Whether a kernel spec has been selected or interpter.
     * If interpreter is selected, then we need to install this as a kernel to get the kernel spec.
     *
     * @type {({ kernelSpec: IJupyterKernelSpec; interpreter: undefined } | { kernelSpec: undefined; interpreter: PythonInterpreter })}
     * @memberof IKernelSpecQuickPickItem
     */
    selection: { kernelSpec: IJupyterKernelSpec; interpreter: undefined } | { kernelSpec: undefined; interpreter: PythonInterpreter };
}

export interface IKernelSelector {
    selectRemoteKernel(session: IJupyterSessionManager, cancelToken?: CancellationToken): Promise<IJupyterKernelSpec | undefined>;
    selectLocalKernel(session?: IJupyterSessionManager, cancelToken?: CancellationToken): Promise<IJupyterKernelSpec | undefined>;
}

export interface IKernelSelectionListProvider {
    getKernelSelections(cancelToken?: CancellationToken): Promise<IKernelSpecQuickPickItem[]>;
}
