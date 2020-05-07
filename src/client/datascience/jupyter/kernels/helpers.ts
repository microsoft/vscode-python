// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import type { Kernel } from '@jupyterlab/services';
import { IJupyterKernelSpec } from '../../types';
import { JupyterKernelSpec } from './jupyterKernelSpec';

// Helper functions for dealing with kernels and kernelspecs

export const defaultKernelSpecName = 'python_defaultSpec_';

// https://jupyter-client.readthedocs.io/en/stable/kernels.html
const connectionFilePlaceholder = '{connection_file}';

// Find the index of the connection file placeholder in a kernelspec
export function findIndexOfConnectionFile(kernelSpec: Readonly<IJupyterKernelSpec>): number {
    return kernelSpec.argv.indexOf(connectionFilePlaceholder);
}
export function createDefaultKernelSpec(displayName?: string): IJupyterKernelSpec {
    // This creates a default kernel spec. When launched, 'python' argument will map to using the interpreter
    // associated with the current resource for launching.
    const defaultSpec: Kernel.ISpecModel = {
        name: defaultKernelSpecName + Date.now().toString(),
        language: 'python',
        display_name: displayName || 'Python 3',
        metadata: {},
        argv: ['python', '-m', 'ipykernel_launcher', '-f', connectionFilePlaceholder],
        env: {},
        resources: {}
    };

    return new JupyterKernelSpec(defaultSpec);
}
