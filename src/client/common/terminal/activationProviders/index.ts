// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { PythonInterpreter } from '../../../interpreter/contracts';
import { TerminalShellType } from '../types';

export const ITerminalActivationCommandProvider = Symbol('ITerminalActivationCommandProvider');

export interface ITerminalActivationCommandProvider {
    isShellSupported(targetShell: TerminalShellType): boolean;
    getActivationCommand(interpreter: PythonInterpreter, targetShell: TerminalShellType): Promise<string | undefined>;
}
