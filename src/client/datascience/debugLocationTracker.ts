// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { injectable } from 'inversify';
import { DebugSession, Event, EventEmitter } from 'vscode';

//import { traceInfo } from '../common/logger';
import { IDebugLocation, IDebugLocationTracker } from './types';

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

    public getDebugLocation(): IDebugLocation | undefined {
        return this._debugLocation;
    }

    // tslint:disable-next-line:no-any
    public onDidSendMessage(message: any) {
        //traceInfo('******** Debugger Message');
        //traceInfo(message.command);
        //traceInfo(message.type);
        //traceInfo(JSON.stringify(message.body));

        if (this.isStopEvent(message)) {
            this.waitingForStackTrace = true;
        }

        // IANHU: Else if?
        if (this.waitingForStackTrace) {
            const debugLoc = this.getStackTrace(message);
            if (debugLoc) {
                this.DebugLocation = debugLoc;
                this.waitingForStackTrace = false;
            }
        }

        if (this.isContinueEvent(message)) {
            this.DebugLocation = undefined;
            this.waitingForStackTrace = false;
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
            if (message.event === 'stop' || message.event === 'stopped') {
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
