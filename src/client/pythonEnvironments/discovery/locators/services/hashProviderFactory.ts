// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Uri } from 'vscode';
import { IConfigurationService } from '../../../../common/types';
import {
    IInterpreterHashProvider,
    IWindowsStoreHashProvider,
    IWindowsStoreInterpreter
} from '../../../../interpreter/locators/types';

export class InterpreterHashProviderFactory {
    constructor(
        private readonly configService: IConfigurationService,
        private readonly windowsStoreInterpreter: IWindowsStoreInterpreter,
        private readonly windowsStoreHashProvider: IWindowsStoreHashProvider,
        private readonly hashProvider: IInterpreterHashProvider
    ) {}

    public async create(options: { pythonPath: string } | { resource: Uri }): Promise<IInterpreterHashProvider> {
        const pythonPath =
            'pythonPath' in options ? options.pythonPath : this.configService.getSettings(options.resource).pythonPath;
        return this.windowsStoreInterpreter.isWindowsStoreInterpreter(pythonPath)
            ? this.windowsStoreHashProvider
            : this.hashProvider;
    }
}
