// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IConfigurationService } from '../../../../common/types';
import {
    IInterpreterHashProvider,
    IInterpreterHashProviderFactory,
    IWindowsStoreInterpreter
} from '../../../../interpreter/locators/types';
import { InterpreterHashProvider } from './hashProvider';
import { WindowsStoreInterpreter } from './windowsStoreInterpreter';

@injectable()
export class InterpeterHashProviderFactory implements IInterpreterHashProviderFactory {
    constructor(
        @inject(IConfigurationService) private readonly configService: IConfigurationService,
        @inject(WindowsStoreInterpreter) private readonly windowsStoreInterpreter: IWindowsStoreInterpreter,
        @inject(WindowsStoreInterpreter) private readonly windowsStoreHashProvider: IInterpreterHashProvider,
        @inject(InterpreterHashProvider) private readonly hashProvider: IInterpreterHashProvider
    ) {}

    public async create(options: { pythonPath: string } | { resource: Uri }): Promise<IInterpreterHashProvider> {
        const pythonPath = 'pythonPath' in options
            ? options.pythonPath
            : this.configService.getSettings(options.resource).pythonPath;
        return this.windowsStoreInterpreter.isWindowsStoreInterpreter(pythonPath)
            ? this.windowsStoreHashProvider
            : this.hashProvider;
    }
}
