// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { inject, injectable } from 'inversify';
import { DebugSession, Event, EventEmitter } from 'vscode';

import { IDebugService } from '../../common/application/types';
import { noop } from '../../common/utils/misc';
import { IInteractiveWindowListener } from '../types';
import { InteractiveWindowMessages } from './interactiveWindowTypes';

// tslint:disable: no-any
@injectable()
export class DebugListener implements IInteractiveWindowListener {
    private postEmitter: EventEmitter<{ message: string; payload: any }> = new EventEmitter<{
        message: string;
        payload: any;
    }>();
    constructor(@inject(IDebugService) private debugService: IDebugService) {
        this.debugService.onDidChangeActiveDebugSession(this.onChangeDebugSession.bind(this));
    }

    public get postMessage(): Event<{ message: string; payload: any }> {
        return this.postEmitter.event;
    }

    public onMessage(message: string, _payload?: any): void {
        switch (message) {
            default:
                break;
        }
    }
    public dispose(): void | undefined {
        noop();
    }

    private onChangeDebugSession(e: DebugSession | undefined) {
        if (e) {
            this.postEmitter.fire({ message: InteractiveWindowMessages.StartDebugging, payload: undefined });
        } else {
            this.postEmitter.fire({ message: InteractiveWindowMessages.StopDebugging, payload: undefined });
        }
    }
}
