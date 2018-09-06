// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { getArchitectureDisplayName } from '../../common/platform/registry';
import { IServiceContainer } from '../../ioc/types';
import { IInterpreterHelper, PythonInterpreter } from '../contracts';
import { IInterpreterComparer } from './types';

@injectable()
export class InterpreterComparer implements IInterpreterComparer {
    private readonly interpreterHelper: IInterpreterHelper;

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.interpreterHelper = this.serviceContainer.get<IInterpreterHelper>(IInterpreterHelper);
    }
    public compare(a: PythonInterpreter, b: PythonInterpreter): number {
        return this.getSortName(a) > this.getSortName(b) ? 1 : -1;
    }
    private getSortName(info: PythonInterpreter): string {
        const sortNameParts: string[] = [];
        const envSuffixParts: string[] = [];

        // Sort order for interpreters is:
        // * Version
        // * Architecture
        // * Interpreter Type
        // * Environment name
        if (info.version_info && info.version_info.length > 0) {
            sortNameParts.push(info.version_info.slice(0, 3).join('.'));
        }
        if (info.version_info) {
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

        const envSuffix = envSuffixParts.length === 0 ? '' :
            `(${envSuffixParts.join(': ')})`;
        return `${sortNameParts.join(' ')} ${envSuffix}`.trim();
    }
}
