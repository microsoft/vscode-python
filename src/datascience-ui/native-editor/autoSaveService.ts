// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IDisposable } from '../../client/common/types';
import { InteractiveWindowMessages } from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { FileSettings } from '../../client/datascience/types';
import { IMessageHandler } from '../react-common/postOffice';
import { getSettings } from '../react-common/settingsReactSide';
import { NativeEditorStateController } from './nativeEditorStateController';

export class AutoSaveService implements IDisposable, IMessageHandler {
    private timeout?: NodeJS.Timer | number;
    private settings?: FileSettings;
    // private fileSettings: typeof
    constructor(private readonly controller: NativeEditorStateController) {
        this.initialize();
    }
    public dispose() {
        this.clearTimeout();
    }
    // tslint:disable-next-line: no-any
    public handleMessage(type: string, _payload?: any): boolean {
        switch (type) {
            // When clean message is sent, this means notebook was saved.
            // We need to reset the timer to start again (timer starts from last save).
            case InteractiveWindowMessages.NotebookClean: {
                this.initialize();
                return true;
            }
            // When settings have been updated, its possible the timer has changed.
            // We need to reset the timer to start again.
            case InteractiveWindowMessages.UpdateSettings: {
                const settings = getSettings().files;
                if (this.settings && this.settings.autoSave === settings.autoSave && this.settings.autoSaveDelay === settings.autoSaveDelay) {
                    return true;
                }
                this.initialize();
                this.settings = settings;
                return true;
            }
            case InteractiveWindowMessages.ActiveTextEditorChanged: {
                // Save if active text editor changes.
                if (this.settings && this.settings.autoSave === 'onFocusChange') {
                    this.save();
                }
                return true;
            }
            case InteractiveWindowMessages.WindowStateChanged: {
                // Save if window state changes.
                if (this.settings && this.settings.autoSave === 'onWindowChange') {
                    this.save();
                }
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
