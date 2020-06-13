// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IInterpreterFilter, IWindowsStoreInterpreter } from '../../../../interpreter/locators/types';
import { PythonInterpreter } from '../../types';
import { WindowsStoreInterpreter } from './windowsStoreInterpreter';

@injectable()
export class InterpreterFilter implements IInterpreterFilter {
    constructor(@inject(WindowsStoreInterpreter) private readonly windowsStoreInterpreter: IWindowsStoreInterpreter) {}
    public isHiddenInterpreter(interpreter: PythonInterpreter): boolean {
        return this.windowsStoreInterpreter.isHiddenInterpreter(interpreter.path);
    }
}
