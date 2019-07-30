// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { injectable } from 'inversify';
import { DebugSession, Event, EventEmitter } from 'vscode';

import { IDebugLocation, IDebugLocationTracker } from './types';

// When a python debugging session is active keep track of the current debug location
@injectable()
export class DebugLocationTracker implements IDebugLocationTracker {
    private waitingForStackTrace: boolean = false;
    private _debugLocation: IDebugLocation | undefined;
    private debugLocationUpdatedEvent: EventEmitter<void> = new EventEmitter<void>();

    public setDebugSession(_targetSession: DebugSession) {
        this.DebugLocation = undefined;
        this.waitingForStackTrace = false;
    }

    public get debugLocationUpdated(): Event<void> {
        return this.debugLocationUpdatedEvent.event;
    }

    public get debugLocation(): IDebugLocation | undefined {
        return this._debugLocation;
    }

    // tslint:disable-next-line:no-any
    public onDidSendMessage(message: any) {
        if (this.isStopEvent(message)) {
            // Some type of stop, wait to see our next stack trace to find our location
            this.waitingForStackTrace = true;
        }

        if (this.isContinueEvent(message)) {
            // Running, clear the location
            this.DebugLocation = undefined;
            this.waitingForStackTrace = false;
        }

        if (this.waitingForStackTrace) {
            // If we are waiting for a stack track, check our messages for one
            const debugLoc = this.getStackTrace(message);
            if (debugLoc) {
                this.DebugLocation = debugLoc;
                this.waitingForStackTrace = false;
            }
        }

    }

    // Set our new location and fire our debug event
    private set DebugLocation(newLocation: IDebugLocation | undefined) {
        const oldLocation = this._debugLocation;
        this._debugLocation = newLocation;

        if (this._debugLocation !== oldLocation) {
            this.debugLocationUpdatedEvent.fire();
        }
    }

    // tslint:disable-next-line:no-any
    private isStopEvent(message: any) {
        if (message.type === 'event') {
            if (message.event === 'stopped') {
                return true;
            }
        }

        return false;
    }

    // tslint:disable-next-line:no-any
    private getStackTrace(message: any): IDebugLocation | undefined {
        if (message.command === 'stackTrace') {
            if (message.body.stackFrames.length > 0) {
                const lineNumber = message.body.stackFrames[0].line;
                const fileName = message.body.stackFrames[0].source.path;
                const column = message.body.stackFrames[0].column;
                return { lineNumber, fileName, column };
            }
        }

        return undefined;
    }

    // tslint:disable-next-line:no-any
    private isContinueEvent(message: any): boolean {
        if ((message.type === 'event' && message.event === 'continue') || (message.command === 'continue' && message.type === 'response')) {
            return true;
        }

        return false;
    }
}
