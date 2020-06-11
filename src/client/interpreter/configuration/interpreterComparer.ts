// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { getArchitectureDisplayName } from '../../common/platform/registry';
import { PythonInterpreter } from '../../pythonEnvironments/discovery/types';
import { IInterpreterHelper } from '../contracts';
import { IInterpreterComparer } from './types';

@injectable()
export class InterpreterComparer implements IInterpreterComparer {
    constructor(@inject(IInterpreterHelper) private readonly interpreterHelper: IInterpreterHelper) {}
    public compare(a: PythonInterpreter, b: PythonInterpreter): number {
        const nameA = this.getSortName(a);
        const nameB = this.getSortName(b);
        if (nameA === nameB) {
            return 0;
        }
        return nameA > nameB ? 1 : -1;
    }
    private getSortName(info: PythonInterpreter): string {
        const sortNameParts: string[] = [];
        const envSuffixParts: string[] = [];

        // Sort order for interpreters is:
        // * Version
        // * Architecture
        // * Interpreter Type
        // * Environment name
        if (info.version) {
            sortNameParts.push(info.version.raw);
        }
        if (info.architecture) {
            sortNameParts.push(getArchitectureDisplayName(info.architecture));
        }
        if (info.companyDisplayName && info.companyDisplayName.length > 0) {
            sortNameParts.push(info.companyDisplayName.trim());
        } else {
            sortNameParts.push('Python');
        }

        if (info.type) {
            const name = this.interpreterHelper.getInterpreterTypeDisplayName(info.type);
            if (name) {
                envSuffixParts.push(name);
            }
        }
        if (info.envName && info.envName.length > 0) {
            envSuffixParts.push(info.envName);
        }

        const envSuffix = envSuffixParts.length === 0 ? '' : `(${envSuffixParts.join(': ')})`;
        return `${sortNameParts.join(' ')} ${envSuffix}`.trim();
    }
}
