// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { CancellationToken, QuickPickItem } from 'vscode';
import { PythonInterpreter } from '../../../interpreter/contracts';
import { IJupyterKernelSpec } from '../../types';

export interface IKernelSpecQuickPickItem extends QuickPickItem {
    selection: { kernelSpec: IJupyterKernelSpec } | { interpreter: PythonInterpreter };
}

export interface IKernelSelector {
    selectKernelSpec(cancelToken?: CancellationToken): Promise<IJupyterKernelSpec | undefined>;
}

export interface IKernelSelectionListProvider {
    getKernelSelections(cancelToken?: CancellationToken): Promise<IKernelSpecQuickPickItem[]>;
}
