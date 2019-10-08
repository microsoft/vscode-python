// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IDisposable } from '../../client/common/types';
import { InteractiveWindowMessages } from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { IMessageHandler } from '../react-common/postOffice';
import { getSettings } from '../react-common/settingsReactSide';
import { NativeEditorStateController } from './nativeEditorStateController';

export class AutoSaveService implements IDisposable, IMessageHandler {
    private timeout?: NodeJS.Timer | number;
    constructor(private readonly controller: NativeEditorStateController) {
        this.initialize();
    }
    public dispose() {
        this.clearTimeout();
    }
    // tslint:disable-next-line: no-any
    public handleMessage(type: string, _payload?: any): boolean {
        switch (type) {
            case InteractiveWindowMessages.UpdateSettings: {
                // Settings have changed.
                this.initialize();
                return true;
            }
            case InteractiveWindowMessages.ActiveTextEditorChanged:
            case InteractiveWindowMessages.WindowStateChanged: {
                this.save();
                return true;
            }
            default: {
                return false;
            }
        }
    }
    public initialize() {
        this.clearTimeout();
        const settings = getSettings().files;
        if (settings.autoSave === 'afterDelay') {
            // Add a timeout to save after n milli seconds.
            this.timeout = setTimeout(() => this.save(), settings.autoSaveDelay);
        }
    }
    private clearTimeout() {
        if (this.timeout) {
            // tslint:disable-next-line: no-any
            clearTimeout(this.timeout as any);
            this.timeout = undefined;
        }
    }
    /**
     * Save the notebook if it is dirty.
     * If auto save is turned off or the notebook is not dirty, then this method is a noop.
     *
     * @private
     * @returns
     * @memberof AutoSaveService
     */
    private save() {
        const settings = getSettings().files;
        if (settings.autoSave === 'off' || this.controller.getState().dirty !== true) {
            return;
        }
        this.controller.save();
    }
}
