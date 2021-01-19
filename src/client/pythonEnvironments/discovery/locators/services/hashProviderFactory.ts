// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IConfigurationService } from '../../../../common/types';
import { IComponentAdapter } from '../../../../interpreter/contracts';
import { IInterpreterHashProvider, IInterpreterHashProviderFactory } from '../../../../interpreter/locators/types';
import { InterpreterHashProvider } from './hashProvider';
import { isWindowsStoreInterpreter, WindowsStoreInterpreter } from './windowsStoreInterpreter';

@injectable()
export class InterpeterHashProviderFactory implements IInterpreterHashProviderFactory {
    constructor(
        @inject(IConfigurationService) private readonly configService: IConfigurationService,
        @inject(WindowsStoreInterpreter) private readonly windowsStoreHashProvider: IInterpreterHashProvider,
        @inject(InterpreterHashProvider) private readonly hashProvider: IInterpreterHashProvider,
        @inject(IComponentAdapter) private readonly pyenvs: IComponentAdapter,
    ) {}

    public async create(options: { pythonPath: string } | { resource: Uri }): Promise<IInterpreterHashProvider> {
        const pythonPath =
            'pythonPath' in options ? options.pythonPath : this.configService.getSettings(options.resource).pythonPath;

        return (await isWindowsStoreInterpreter(pythonPath, this.pyenvs))
            ? this.windowsStoreHashProvider
            : this.hashProvider;
    }
}
