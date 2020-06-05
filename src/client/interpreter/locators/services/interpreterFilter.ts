// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { PythonInterpreter } from '../../../pythonEnvironments/discovery/types';
import { IInterpreterFilter, IWindowsStoreInterpreter } from '../types';
import { WindowsStoreInterpreter } from './windowsStoreInterpreter';

@injectable()
export class InterpreterFilter implements IInterpreterFilter {
    constructor(@inject(WindowsStoreInterpreter) private readonly windowsStoreInterpreter: IWindowsStoreInterpreter) {}
    public isHiddenInterpreter(interpreter: PythonInterpreter): boolean {
        return this.windowsStoreInterpreter.isHiddenInterpreter(interpreter.path);
    }
}
