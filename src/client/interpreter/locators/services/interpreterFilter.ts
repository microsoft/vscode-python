// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { PythonInterpreter } from '../../contracts';
import { IInterpreterFilter, IWindowsStoreInterpreter } from '../types';
import { WindowsStoreInterpreter } from './windowsStoreInterpreter';

@injectable()
export class InterpreterFilter implements IInterpreterFilter {
    constructor(@inject(WindowsStoreInterpreter) private readonly windowsStoreInterpreter: IWindowsStoreInterpreter) {}
    public canIgnoreIntepreter(interpreter: PythonInterpreter): boolean {
        return this.windowsStoreInterpreter.isInternalInterpreter(interpreter.path);
    }
}
