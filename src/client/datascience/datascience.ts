// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IApplicationShell, ICommandManager } from '../common/application/types';
import { IDisposableRegistry } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { Commands } from './constants';
import { IDataScience } from './types';

@injectable()
export class DataScience implements IDataScience {
    private readonly appShell: IApplicationShell;
    private readonly commandManager: ICommandManager;
    private readonly disposableRegistry: IDisposableRegistry;
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer)
    {
        this.appShell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
        this.commandManager = this.serviceContainer.get<ICommandManager>(ICommandManager);
        this.disposableRegistry = this.serviceContainer.get<IDisposableRegistry>(IDisposableRegistry);
    }

    public async activate(): Promise<void> {
        this.registerCommands();
    }

    public async executeDataScience(): Promise<void> {
       await this.appShell.showInformationMessage('Hello Data Science');
    }

    private registerCommands(): void {
        const disposable = this.commandManager.registerCommand(Commands.DataScience, this.executeDataScience, this);
        this.disposableRegistry.push(disposable);
    }
}
