// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { PythonEnvironment } from '../../pythonEnvironments/info';
import { IInterpreterHelper } from '../contracts';
import { getSortName } from './environmentTypeComparer';
import { IInterpreterComparer } from './types';

@injectable()
export class InterpreterComparer implements IInterpreterComparer {
    constructor(@inject(IInterpreterHelper) private readonly interpreterHelper: IInterpreterHelper) {}
    public compare(a: PythonEnvironment, b: PythonEnvironment): number {
        const nameA = getSortName(a, this.interpreterHelper);
        const nameB = getSortName(b, this.interpreterHelper);
        if (nameA === nameB) {
            return 0;
        }
        return nameA > nameB ? 1 : -1;
    }
}
