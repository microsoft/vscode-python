// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { inject, injectable } from 'inversify';
import { Event, EventEmitter } from 'vscode';

import { IApplicationShell } from '../../common/application/types';
import { IFileSystem } from '../../common/platform/types';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { IInteractiveWindowListener } from '../types';
import { InteractiveWindowMessages } from './interactiveWindowTypes';

// tslint:disable: no-any
@injectable()
export class LinkProvider implements IInteractiveWindowListener {
    private postEmitter: EventEmitter<{ message: string; payload: any }> = new EventEmitter<{ message: string; payload: any }>();
    constructor(@inject(IApplicationShell) private applicationShell: IApplicationShell, @inject(IFileSystem) private fileSystem: IFileSystem) {
        noop();
    }

    public get postMessage(): Event<{ message: string; payload: any }> {
        return this.postEmitter.event;
    }

    public onMessage(message: string, payload?: any): void {
        switch (message) {
            case InteractiveWindowMessages.OpenLink:
                if (payload) {
                    this.applicationShell.openUrl(payload.toString());
                }
                break;
            case InteractiveWindowMessages.SavePng:
                if (payload) {
                    // Payload should contain the base 64 encoded string. Ask the user to save the file
                    const filtersObject: Record<string, string[]> = {};
                    filtersObject[localize.DataScience.pngFilter()] = ['png'];

                    // Ask the user what file to save to
                    this.applicationShell
                        .showSaveDialog({
                            saveLabel: localize.DataScience.savePngTitle(),
                            filters: filtersObject
                        })
                        .then(f => {
                            if (f) {
                                const buffer = new Buffer(payload.replace('data:image/png;base64', ''), 'base64');
                                this.fileSystem.writeFile(f.fsPath, buffer).ignoreErrors();
                            }
                        });
                }
                break;
            default:
                break;
        }
    }
    public dispose(): void | undefined {
        noop();
    }
}
