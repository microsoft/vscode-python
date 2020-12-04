// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import { DebugAdapterTracker, DebugAdapterTrackerFactory, DebugSession, ProviderResult } from 'vscode';
import { DebugProtocol } from 'vscode-debugprotocol';

import { IExtensionSingleActivationService } from '../../activation/types';
import { AttachRequestArguments, ConsoleType, LaunchRequestArguments, TriggerType } from '../../debugger/types';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { IDisposableRegistry } from '../types';
import { StopWatch } from '../utils/stopWatch';
import { IDebugService } from './types';

// tslint:disable-next-line no-any
function isResponse(a: any): a is DebugProtocol.Response {
    return a.type === 'response';
}
class TelemetryTracker implements DebugAdapterTracker {
    private timer = new StopWatch();
    private readonly trigger: TriggerType = 'launch';
    private readonly console: ConsoleType | undefined;

    constructor(session: DebugSession) {
        this.trigger = session.configuration.type as TriggerType;
        const debugConfiguration = session.configuration as Partial<LaunchRequestArguments & AttachRequestArguments>;
        this.console = debugConfiguration.console;
    }

    public onWillStartSession() {
        this.sendTelemetry(EventName.DEBUG_SESSION_START);
    }

    // tslint:disable-next-line no-any
    public onDidSendMessage(message: any): void {
        if (isResponse(message)) {
            if (message.command === 'configurationDone') {
                // "configurationDone" response is sent immediately after user code starts running.
                this.sendTelemetry(EventName.DEBUG_SESSION_USER_CODE_RUNNING);
            }
        }
    }

    public onWillStopSession(): void {
        this.sendTelemetry(EventName.DEBUG_SESSION_STOP);
    }

    public onError?(_error: Error): void {
        this.sendTelemetry(EventName.DEBUG_SESSION_ERROR);
    }

    private sendTelemetry(eventName: EventName): void {
        if (eventName === EventName.DEBUG_SESSION_START) {
            this.timer.reset();
        }
        const telemetryProps = {
            trigger: this.trigger,
            console: this.console
        };
        sendTelemetryEvent(eventName, this.timer.elapsedTime, telemetryProps);
    }
}

@injectable()
export class DebugSessionTelemetry implements DebugAdapterTrackerFactory, IExtensionSingleActivationService {
    constructor(
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry,
        @inject(IDebugService) debugService: IDebugService
    ) {
        disposableRegistry.push(debugService.registerDebugAdapterTrackerFactory('python', this));
    }

    public async activate(): Promise<void> {
        // We actually register in the constructor. Not necessary to do it here
    }

    public createDebugAdapterTracker(session: DebugSession): ProviderResult<DebugAdapterTracker> {
        return new TelemetryTracker(session);
    }
}
