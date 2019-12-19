// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject } from 'inversify';
import { IApplicationShell, ICommandManager } from '../../../common/application/types';
import { Commands } from '../../../common/constants';
import { IDisposableRegistry } from '../../../common/types';
import { AttachPicker } from './picker';
import { IAttachItem, IAttachProcessProvider } from './types';

export abstract class BaseAttachProcessProvider implements IAttachProcessProvider {
    constructor(@inject(IApplicationShell) private readonly applicationShell: IApplicationShell,
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IDisposableRegistry) private readonly disposableRegistry: IDisposableRegistry) { }

    public registerCommands() {
        const picker = new AttachPicker(this.applicationShell, this);
        const disposable = this.commandManager.registerCommand(Commands.PickLocalProcess, () => picker.showQuickPick(), this);
        this.disposableRegistry.push(disposable);
    }

    public getAttachItems(): Promise<IAttachItem[]> {
        return this._getInternalProcessEntries().then(processEntries => {
            // localeCompare is significantly slower than < and > (2000 ms vs 80 ms for 10,000 elements)
            // We can change to localeCompare if this becomes an issue
            processEntries.sort((a, b) => {
                const aLower = a.label.toLowerCase();
                const bLower = b.label.toLowerCase();

                if (aLower === bLower) {
                    return 0;
                }

                return aLower < bLower ? -1 : 1;
            });

            return processEntries;
        });
    }

    public abstract _getInternalProcessEntries(): Promise<IAttachItem[]>;
}
