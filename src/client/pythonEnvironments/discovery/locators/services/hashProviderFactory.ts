// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject } from 'inversify';
import { Uri } from 'vscode';
import { IConfigurationService } from '../../../../common/types';
import {
    IInterpreterHashProvider,
    IWindowsStoreHashProvider,
    IWindowsStoreInterpreter
} from '../../../../interpreter/locators/types';

export class InterpreterHashProviderFactory {
    constructor(
        @inject(IConfigurationService) private readonly configService: IConfigurationService,
        @inject(IWindowsStoreInterpreter) private readonly windowsStoreInterpreter: IWindowsStoreInterpreter,
        @inject(IWindowsStoreHashProvider) private readonly windowsStoreHashProvider: IWindowsStoreHashProvider,
        @inject(IInterpreterHashProvider) private readonly hashProvider: IInterpreterHashProvider
    ) {}

    public async create(options: { pythonPath: string } | { resource: Uri }): Promise<IInterpreterHashProvider> {
        const pythonPath =
            'pythonPath' in options ? options.pythonPath : this.configService.getSettings(options.resource).pythonPath;
        return this.windowsStoreInterpreter.isWindowsStoreInterpreter(pythonPath)
            ? this.windowsStoreHashProvider
            : this.hashProvider;
    }
}
