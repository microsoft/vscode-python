// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { IInterpreterService } from '../../interpreter/contracts';
import { PythonInterpreter } from '../../pythonEnvironments/discovery/types';
import { IJupyterKernelSpec } from '../types';

// For a given IJupyterKernelSpec return the interpreter associated with it or error
export async function getKernelInterpreter(
    kernelSpec: IJupyterKernelSpec,
    interpreterService: IInterpreterService
): Promise<PythonInterpreter> {
    // First part of argument is always the executable.
    const args = [...kernelSpec.argv];
    const pythonPath = kernelSpec.metadata?.interpreter?.path || args[0];

    // Use that to find the matching interpeter.
    const matchingInterpreter = await interpreterService.getInterpreterDetails(pythonPath);

    if (!matchingInterpreter) {
        throw new Error(`Failed to find interpreter for kernelspec ${kernelSpec.display_name}`);
    }

    return matchingInterpreter;
}
