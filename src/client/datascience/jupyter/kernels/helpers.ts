// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import type { Kernel } from '@jupyterlab/services';
import { IJupyterKernelSpec } from '../../types';
import { JupyterKernelSpec } from './jupyterKernelSpec';
// tslint:disable-next-line: no-var-requires no-require-imports
const NamedRegexp = require('named-js-regexp') as typeof import('named-js-regexp');

// tslint:disable-next-line: no-require-imports
import cloneDeep = require('lodash/cloneDeep');
import {
    DefaultKernelConnectionMetadata,
    KernelConnectionMetadata,
    KernelSpecConnectionMetadata,
    LiveKernelConnectionMetadata,
    PythonKernelConnectionMetadata
} from './types';

// Helper functions for dealing with kernels and kernelspecs

export const defaultKernelSpecName = 'python_defaultSpec_';

// https://jupyter-client.readthedocs.io/en/stable/kernels.html
const connectionFilePlaceholder = '{connection_file}';

// Find the index of the connection file placeholder in a kernelspec
export function findIndexOfConnectionFile(kernelSpec: Readonly<IJupyterKernelSpec>): number {
    return kernelSpec.argv.indexOf(connectionFilePlaceholder);
}

type ConnectionWithKernelSpec =
    | KernelSpecConnectionMetadata
    | PythonKernelConnectionMetadata
    | DefaultKernelConnectionMetadata;
export function kernelConnectionMetadataHasKernelSpec(
    connectionMetadata: KernelConnectionMetadata
): connectionMetadata is ConnectionWithKernelSpec {
    return connectionMetadata.kind !== 'connectToLiveKernel';
}
export function kernelConnectionMetadataHasKernelModel(
    connectionMetadata: KernelConnectionMetadata
): connectionMetadata is LiveKernelConnectionMetadata {
    return connectionMetadata.kind === 'connectToLiveKernel';
}
// Create a default kernelspec with the given display name
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

// Check if a name is a default python kernel name and pull the version
export function detectDefaultKernelName(name: string) {
    const regEx = NamedRegexp('python\\s*(?<version>(\\d+))', 'g');
    return regEx.exec(name.toLowerCase());
}

export function cleanEnvironment<T>(spec: T): T {
    // tslint:disable-next-line: no-any
    const copy = cloneDeep(spec) as { env?: any };

    if (copy.env) {
        // Scrub the environment of the spec to make sure it has allowed values (they all must be strings)
        // See this issue here: https://github.com/microsoft/vscode-python/issues/11749
        const keys = Object.keys(copy.env);
        keys.forEach((k) => {
            if (copy.env) {
                const value = copy.env[k];
                if (value !== null && value !== undefined) {
                    copy.env[k] = value.toString();
                }
            }
        });
    }

    return copy as T;
}
