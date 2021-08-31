// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { CallInfo, trace as traceDecorator, TraceDecoratorType } from '../common/utils/decorators';
import { TraceInfo, tracing as _tracing } from '../common/utils/misc';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { LogLevel } from './levels';
import { ILogger, logToAll } from './logger';
import { argsToLogString, returnValueToLogString } from './util';

// The information we want to log.
export enum TraceOptions {
    None = 0,
    Arguments = 1,
    ReturnValue = 2,
}

export function createTracingDecorator(loggers: ILogger[], logInfo: LogInfo): TraceDecoratorType {
    return traceDecorator((call, traced) => logResult(loggers, logInfo, traced, call));
}

// This is like a "context manager" that logs tracing info.
export function tracing<T>(loggers: ILogger[], logInfo: LogInfo, run: () => T, call?: CallInfo): T {
    return _tracing((traced) => logResult(loggers, logInfo, traced, call), run);
}

export type LogInfo = {
    opts: TraceOptions;
    message: string;
    level?: LogLevel;
};

function normalizeCall(call: CallInfo): CallInfo {
    let { kind, name, args } = call;
    if (!kind || kind === '') {
        kind = 'Function';
    }
    if (!name || name === '') {
        name = '<anon>';
    }
    if (!args) {
        args = [];
    }
    return { kind, name, args };
}

function formatMessages(info: LogInfo, traced: TraceInfo, call?: CallInfo): string {
    call = normalizeCall(call!);
    const messages = [info.message];
    messages.push(
        `${call.kind} name = ${call.name}`.trim(),
        `completed in ${traced.elapsed}ms`,
        `has a ${traced.returnValue ? 'truthy' : 'falsy'} return value`,
    );
    if ((info.opts & TraceOptions.Arguments) === TraceOptions.Arguments) {
        messages.push(argsToLogString(call.args));
    }
    if ((info.opts & TraceOptions.ReturnValue) === TraceOptions.ReturnValue) {
        messages.push(returnValueToLogString(traced.returnValue));
    }
    return messages.join(', ');
}

function logResult(loggers: ILogger[], info: LogInfo, traced: TraceInfo, call?: CallInfo) {
    const formatted = formatMessages(info, traced, call);
    if (traced.err === undefined) {
        // The call did not fail.
        if (!info.level || info.level > LogLevel.Error) {
            logToAll(loggers, LogLevel.Info, [formatted]);
        }
    } else {
        logToAll(loggers, LogLevel.Error, [formatted, traced.err]);

        sendTelemetryEvent(('ERROR' as unknown) as EventName, undefined, undefined, traced.err);
    }
}
