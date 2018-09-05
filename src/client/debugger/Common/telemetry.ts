// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-function-expression no-any no-invalid-this no-use-before-declare

import { DebugSession, StoppedEvent } from 'vscode-debugadapter';
import { StopWatch } from '../../../utils/stopWatch';
import { DEBUGGER_PERFORMANCE } from '../../telemetry/constants';
import { DebuggerPerformanceTelemetry } from '../../telemetry/types';
import { TelemetryEvent } from './Contracts';

type DebugAction = 'stepIn' | 'stepOut' | 'continue' | 'next' | 'launch';
type DebugPerformanceInformation = { action: DebugAction; timer: StopWatch };

const executionStack: DebugPerformanceInformation[] = [];

export enum PerformanceTelemetryCondition {
    always = 0,
    stoppedEvent = 1
}

export function capturePerformanceTelemetry(action: DebugAction) {
    return function (target: DebugSession, _propertyKey: string, descriptor: TypedPropertyDescriptor<any>) {
        const originalMethod = descriptor.value;
        descriptor.value = function (...args: any[]) {
            executionStack.push({ action, timer: new StopWatch() });
            return originalMethod.apply(this, args);
        };

        return descriptor;
    };
}

export function sendPerformanceTelemetry(condition: PerformanceTelemetryCondition) {
    return function (target: DebugSession, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) {
        const originalMethod = descriptor.value;
        descriptor.value = function (...args: any[]) {
            if (propertyKey === 'sendEvent' && args.length === 1 && args[0] instanceof TelemetryEvent) {
                return originalMethod.apply(this, args);
            }

            try {
                const data = getPerformanceTelemetryData(condition, args);
                if (data) {
                    this.sendEvent(new TelemetryEvent(DEBUGGER_PERFORMANCE, data));
                }
            } catch {
                // We don't want errors here interfering the user's work, hence swallow exceptions.
            }
            return originalMethod.apply(this, args);
        };

        return descriptor;
    };
}

function getPerformanceTelemetryData(condition: PerformanceTelemetryCondition, functionArgs: any[]): DebuggerPerformanceTelemetry | undefined {
    if (executionStack.length === 0) {
        return;
    }
    let item: DebugPerformanceInformation | undefined;
    switch (condition) {
        case PerformanceTelemetryCondition.always: {
            item = executionStack.pop();
        }
        case PerformanceTelemetryCondition.stoppedEvent: {
            if (functionArgs.length > 0 && functionArgs[0] instanceof StoppedEvent) {
                item = executionStack.pop();
            }
            break;
        }
        default: {
            return;
        }
    }
    if (item) {
        return { action: item!.action, duration: item!.timer.elapsedTime };
    }
}
