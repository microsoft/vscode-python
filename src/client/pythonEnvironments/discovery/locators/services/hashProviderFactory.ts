// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { injectable } from 'inversify';
import { IInterpreterHashProvider, IInterpreterHashProviderFactory } from '../../../../interpreter/locators/types';
import { isWindowsStoreInterpreter } from './windowsStoreInterpreter';

@injectable()
export class InterpeterHashProviderFactory implements IInterpreterHashProviderFactory {
    constructor(
        private readonly windowsStoreHashProvider: IInterpreterHashProvider,
        private readonly standardHashProvider: IInterpreterHashProvider
    ) {}

    public async create(pythonPath: string): Promise<IInterpreterHashProvider> {
        return isWindowsStoreInterpreter(pythonPath) ? this.windowsStoreHashProvider : this.standardHashProvider;
    }
}
