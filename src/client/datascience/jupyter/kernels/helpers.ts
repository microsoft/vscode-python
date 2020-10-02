// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import type { Kernel } from '@jupyterlab/services';
import * as fastDeepEqual from 'fast-deep-equal';
import { IJupyterKernelSpec } from '../../types';
import { JupyterKernelSpec } from './jupyterKernelSpec';
// tslint:disable-next-line: no-var-requires no-require-imports
const NamedRegexp = require('named-js-regexp') as typeof import('named-js-regexp');

// tslint:disable-next-line: no-require-imports
import cloneDeep = require('lodash/cloneDeep');
import { PYTHON_LANGUAGE } from '../../../common/constants';
import { ReadWrite } from '../../../common/types';
import { PythonEnvironment } from '../../../pythonEnvironments/info';
import {
    DefaultKernelConnectionMetadata,
    KernelConnectionMetadata,
    KernelSpecConnectionMetadata,
    LiveKernelConnectionMetadata,
    LiveKernelModel,
    PythonKernelConnectionMetadata
} from './types';

// Helper functions for dealing with kernels and kernelspecs

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
export function getDisplayNameOrNameOfKernelConnection(
    kernelConnection: KernelConnectionMetadata | undefined,
    defaultValue: string = ''
) {
    if (!kernelConnection) {
        return defaultValue;
    }
    const displayName =
        kernelConnection.kind === 'connectToLiveKernel'
            ? kernelConnection.kernelModel.display_name
            : kernelConnection.kernelSpec?.display_name;
    const name =
        kernelConnection.kind === 'connectToLiveKernel'
            ? kernelConnection.kernelModel.name
            : kernelConnection.kernelSpec?.name;

    const interpeterName =
        kernelConnection.kind === 'startUsingPythonInterpreter' ? kernelConnection.interpreter.displayName : undefined;

    const defaultKernelName = kernelConnection.kind === 'startUsingDefaultKernel' ? 'Python 3' : undefined;
    return displayName || name || interpeterName || defaultKernelName || defaultValue;
}

export function getNameOfKernelConnection(
    kernelConnection: KernelConnectionMetadata | undefined,
    defaultValue: string = ''
) {
    if (!kernelConnection) {
        return defaultValue;
    }
    return kernelConnection.kind === 'connectToLiveKernel'
        ? kernelConnection.kernelModel.name
        : kernelConnection.kernelSpec?.name;
}

export function getKernelPathFromKernelConnection(kernelConnection?: KernelConnectionMetadata): string | undefined {
    if (!kernelConnection) {
        return;
    }
    const model = kernelConnectionMetadataHasKernelModel(kernelConnection) ? kernelConnection.kernelModel : undefined;
    const kernelSpec = kernelConnectionMetadataHasKernelSpec(kernelConnection)
        ? kernelConnection.kernelSpec
        : undefined;
    return model?.path || kernelSpec?.path;
}
export function getInterpreterFromKernelConnectionMetadata(
    kernelConnection?: KernelConnectionMetadata
): Partial<PythonEnvironment> | undefined {
    if (!kernelConnection) {
        return;
    }
    if (kernelConnection.interpreter) {
        return kernelConnection.interpreter;
    }
    const model = kernelConnectionMetadataHasKernelModel(kernelConnection) ? kernelConnection.kernelModel : undefined;
    if (model?.metadata?.interpreter) {
        return model.metadata.interpreter;
    }
    const kernelSpec = kernelConnectionMetadataHasKernelSpec(kernelConnection)
        ? kernelConnection.kernelSpec
        : undefined;
    return kernelSpec?.metadata?.interpreter;
}
export function isPythonKernelConnection(kernelConnection?: KernelConnectionMetadata): boolean {
    if (!kernelConnection) {
        return false;
    }
    if (kernelConnection.kind === 'startUsingPythonInterpreter') {
        return true;
    }
    const model = kernelConnectionMetadataHasKernelModel(kernelConnection) ? kernelConnection.kernelModel : undefined;
    const kernelSpec = kernelConnectionMetadataHasKernelSpec(kernelConnection)
        ? kernelConnection.kernelSpec
        : undefined;
    return model?.language === PYTHON_LANGUAGE || kernelSpec?.language === PYTHON_LANGUAGE;
}
export function getKernelConnectionLanguage(kernelConnection?: KernelConnectionMetadata): string | undefined {
    if (!kernelConnection) {
        return;
    }
    const model = kernelConnectionMetadataHasKernelModel(kernelConnection) ? kernelConnection.kernelModel : undefined;
    const kernelSpec = kernelConnectionMetadataHasKernelSpec(kernelConnection)
        ? kernelConnection.kernelSpec
        : undefined;
    return model?.language || kernelSpec?.language;
}
// Create a default kernelspec with the given display name
export function createDefaultKernelSpec(interpreter?: PythonEnvironment): IJupyterKernelSpec {
    // This creates a default kernel spec. When launched, 'python' argument will map to using the interpreter
    // associated with the current resource for launching.
    const defaultSpec: Kernel.ISpecModel = {
        name: interpreter?.displayName || 'Python 3',
        language: 'python',
        display_name: interpreter?.displayName || 'Python 3',
        metadata: {},
        argv: ['python', '-m', 'ipykernel_launcher', '-f', connectionFilePlaceholder],
        env: {},
        resources: {}
    };

    return new JupyterKernelSpec(defaultSpec);
}

export function areKernelConnectionsEqual(
    connection1?: KernelConnectionMetadata,
    connection2?: KernelConnectionMetadata
) {
    if (!connection1 && !connection2) {
        return true;
    }
    if (!connection1 && connection2) {
        return false;
    }
    if (connection1 && !connection2) {
        return false;
    }
    if (connection1?.kind !== connection2?.kind) {
        return false;
    }
    if (connection1?.kind === 'connectToLiveKernel' && connection2?.kind === 'connectToLiveKernel') {
        return areKernelModelsEqual(connection1.kernelModel, connection2.kernelModel);
    } else if (
        connection1 &&
        connection1.kind !== 'connectToLiveKernel' &&
        connection2 &&
        connection2.kind !== 'connectToLiveKernel'
    ) {
        const kernelSpecsAreTheSame = areKernelSpecsEqual(connection1?.kernelSpec, connection2?.kernelSpec);
        // If both are launching interpreters, compare interpreter paths.
        const interpretersAreSame =
            connection1.kind === 'startUsingPythonInterpreter'
                ? connection1.interpreter.path === connection2.interpreter?.path
                : true;

        return kernelSpecsAreTheSame && interpretersAreSame;
    }
    return false;
}
function areKernelSpecsEqual(kernelSpec1?: IJupyterKernelSpec, kernelSpec2?: IJupyterKernelSpec) {
    if (kernelSpec1 && kernelSpec2) {
        const spec1 = cloneDeep(kernelSpec1) as ReadWrite<IJupyterKernelSpec>;
        spec1.env = spec1.env || {};
        spec1.metadata = spec1.metadata || {};
        const spec2 = cloneDeep(kernelSpec2) as ReadWrite<IJupyterKernelSpec>;
        spec2.env = spec1.env || {};
        spec2.metadata = spec1.metadata || {};

        return fastDeepEqual(spec1, spec2);
    } else if (!kernelSpec1 && !kernelSpec2) {
        return true;
    } else {
        return false;
    }
}
function areKernelModelsEqual(kernelModel1?: LiveKernelModel, kernelModel2?: LiveKernelModel) {
    if (kernelModel1 && kernelModel2) {
        const model1 = cloneDeep(kernelModel1) as ReadWrite<LiveKernelModel>;
        model1.env = model1.env || {};
        model1.metadata = model1.metadata || {};
        const model2 = cloneDeep(kernelModel2) as ReadWrite<LiveKernelModel>;
        model2.env = model1.env || {};
        model2.metadata = model1.metadata || {};
        return fastDeepEqual(model1, model2);
    } else if (!kernelModel1 && !kernelModel2) {
        return true;
    } else {
        return false;
    }
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
