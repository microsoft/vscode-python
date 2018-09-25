// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Disposable, ExtensionContext } from 'vscode';
import { IApplicationShell, ICommandManager } from '../common/application/types';
import { IDisposableRegistry } from '../common/types';
import { IDataScience } from './types';

@injectable()
export class DataScience implements IDataScience {
    constructor(@inject(ICommandManager) private commandManager: ICommandManager,
        @inject(IDisposableRegistry) private disposableRegistry: Disposable[],
        @inject(IApplicationShell) private appShell: IApplicationShell) {
        }

    public async activate(context: ExtensionContext): Promise<void> {
        this.registerCommands();
    }

    private registerCommands(): void {
        const disposable = this.commandManager.registerCommand('python.datascience', this.executeDataScience, this);
        this.disposableRegistry.push(disposable);
    }

    private async executeDataScience(): Promise<void> {
       await this.appShell.showInformationMessage('Hello Data Science');
    }
}
