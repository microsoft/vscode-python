// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { injectable } from 'inversify';
import { DebugAdapterTracker, Event, EventEmitter } from 'vscode';
import { DebugProtocol } from 'vscode-debugprotocol';

import { IDebugLocation } from './types';

// When a python debugging session is active keep track of the current debug location
@injectable()
export class DebugLocationTracker implements DebugAdapterTracker {
    protected topMostFrameId = 0;
    protected sequenceNumbersOfRequestsPendingResponses = new Set<number>();
    private waitingForStackTrace = false;
    private _debugLocation: IDebugLocation | undefined;
    private debugLocationUpdatedEvent: EventEmitter<void> = new EventEmitter<void>();
    private sessionEndedEmitter: EventEmitter<DebugLocationTracker> = new EventEmitter<DebugLocationTracker>();

    constructor(private _sessionId: string | undefined) {
        this.DebugLocation = undefined;
    }

    public get sessionId() {
        return this._sessionId;
    }

    public get sessionEnded(): Event<DebugLocationTracker> {
        return this.sessionEndedEmitter.event;
    }

    public get debugLocationUpdated(): Event<void> {
        return this.debugLocationUpdatedEvent.event;
    }

    public get debugLocation(): IDebugLocation | undefined {
        return this._debugLocation;
    }

    public onDidSendMessage(message: DebugProtocol.Response) {
        if (this.isResponseForRequestToFetchAllFrames(message)) {
            // This should be the top frame. We need to use this to compute the value of a variable
            const topMostFrame = message.body.stackFrames[0];
            this.topMostFrameId = topMostFrame?.id;
            this.sequenceNumbersOfRequestsPendingResponses.delete(message.request_seq);
            // If we are waiting for a stack trace, check our messages for one
            if (this.waitingForStackTrace) {
                this.DebugLocation = {
                    lineNumber: topMostFrame?.line,
                    fileName: this.normalizeFilePath(topMostFrame?.source?.path),
                    column: topMostFrame.column
                };
                this.waitingForStackTrace = false;
            }
        }
        if (this.isStopEvent(message)) {
            // Some type of stop, wait to see our next stack trace to find our location
            this.waitingForStackTrace = true;
        }

        if (this.isContinueEvent(message)) {
            // Running, clear the location
            this.DebugLocation = undefined;
            this.waitingForStackTrace = false;
        }
    }

    public onWillStopSession() {
        this.sessionEndedEmitter.fire(this);
    }

    public onWillReceiveMessage(message: DebugProtocol.Request) {
        if (this.isRequestToFetchAllFrames(message)) {
            // VSCode sometimes sends multiple stackTrace requests. The true topmost frame is determined
            // based on the response to a stackTrace request where the startFrame is 0 or undefined (i.e.
            // this request retrieves all frames). Here, remember the sequence number of the outgoing
            // request whose startFrame === 0 or undefined, and update this.topMostFrameId only when we
            // receive the response with a matching sequence number.
            this.sequenceNumbersOfRequestsPendingResponses.add(message.seq);
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

    private normalizeFilePath(path: string): string {
        // Make the path match the os. Debugger seems to return
        // invalid path chars on linux/darwin
        if (process.platform !== 'win32') {
            return path.replace(/\\/g, '/');
        }
        return path;
    }

    private isStopEvent(message: DebugProtocol.ProtocolMessage) {
        if (message.type === 'event') {
            const eventMessage = message as DebugProtocol.Event;
            if (eventMessage.event === 'stopped') {
                return true;
            }
        }

        return false;
    }

    private isContinueEvent(message: DebugProtocol.ProtocolMessage): boolean {
        if (message.type === 'event') {
            const eventMessage = message as DebugProtocol.Event;
            if (eventMessage.event === 'continue') {
                return true;
            }
        } else if (message.type === 'response') {
            const responseMessage = message as DebugProtocol.Response;
            if (responseMessage.command === 'continue') {
                return true;
            }
        }

        return false;
    }

    private isResponseForRequestToFetchAllFrames(message: DebugProtocol.Response) {
        return (
            message.type === 'response' &&
            message.command === 'stackTrace' &&
            message.body.stackFrames[0] &&
            this.sequenceNumbersOfRequestsPendingResponses.has(message.request_seq)
        );
    }

    private isRequestToFetchAllFrames(message: DebugProtocol.Request) {
        return (
            message.type === 'request' &&
            message.command === 'stackTrace' &&
            (message.arguments.startFrame === 0 || message.arguments.startFrame === undefined)
        );
    }
}
