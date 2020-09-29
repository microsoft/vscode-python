// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { pathExists } from '../../../common/externalDependencies';


/**
 * Checks if the given interpreter belongs to a venv based environment.
 * @param {string} interpreterPath: Absolute path to the python interpreter.
 * @returns {boolean} : Returns true if the interpreter belongs to a venv environment.
 */
export async function isVenvEnvironment(interpreterPath:string): Promise<boolean>{
    const pyvenvConfigFile = 'pyvenv.cfg';

    // Check if the pyvenv.cfg file is in the directory as the interpreter.
    // env
    // |__ pyvenv.cfg  <--- check if this file exists
    // |__ python  <--- interpreterPath
    const venvPath1 = path.join(path.dirname(interpreterPath), pyvenvConfigFile);

    // Check if the pyvenv.cfg file is in the parent directory relative to the interpreter.
    // env
    // |__ pyvenv.cfg  <--- check if this file exists
    // |__ bin or Scripts
    //     |__ python  <--- interpreterPath
    const venvPath2 = path.join(path.dirname(path.dirname(interpreterPath)), pyvenvConfigFile);

    return [await pathExists(venvPath1), await pathExists(venvPath2)].includes(true);
}
