// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Event, EventEmitter } from 'vscode';
import { ICommandManager } from '../../common/application/types';
import '../../common/extensions';
import { IDisposable } from '../../common/types';
import { ILanguageServerExtension } from '../types';

const loadExtensionCommand = 'python._loadLanguageServerExtension';

@injectable()
export class LanguageServerExtension implements ILanguageServerExtension {
    public loadExtensionArgs?: {};
    protected readonly _invoked = new EventEmitter<void>();
    private disposable?: IDisposable;
    constructor(@inject(ICommandManager) private readonly commandManager: ICommandManager) {}
    public dispose() {
        if (this.disposable) {
            this.disposable.dispose();
        }
    }
    public async register(): Promise<void> {
        if (this.disposable) {
            return;
        }
        this.disposable = this.commandManager.registerCommand(loadExtensionCommand, args => {
            this.loadExtensionArgs = args;
            this._invoked.fire();
        });
    }
    public get invoked(): Event<void> {
        return this._invoked.event;
    }
}
