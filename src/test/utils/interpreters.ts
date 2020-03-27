// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Architecture } from '../../client/common/utils/platform';
import { InterpreterType, PythonInterpreter } from '../../client/interpreter/contracts';

/**
 * Creates a PythonInterpreter object for testing purposes, with unique name, version and path.
 * If required a custom name, version and the like can be provided.
 *
 * @export
 * @param {Partial<PythonInterpreter>} [info]
 * @returns {PythonInterpreter}
 */
export function createPythonInterpreter(info?: Partial<PythonInterpreter>): PythonInterpreter {
    const rnd = new Date().getTime().toString();
    return {
        displayName: `Something${rnd}`,
        architecture: Architecture.Unknown,
        path: `somePath${rnd}`,
        sysPrefix: `someSysPrefix${rnd}`,
        sysVersion: `1.1.1`,
        type: InterpreterType.Unknown,
        ...(info || {}),
    };
}
