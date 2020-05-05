// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { CallInfo, trace as traceDecorator } from '../common/utils/decorators';
import { TraceInfo, tracing as _tracing } from '../common/utils/misc';
import { sendTelemetryEvent } from '../telemetry';
import { LogLevel } from './levels';
import { _log as log } from './logger';
import { TraceOptions } from './types';
import { argsToLogString, returnValueToLogString } from './util';

// tslint:disable-next-line:no-any
export function traceVerbose(...args: any[]) {
    log(LogLevel.Info, ...args);
}

// tslint:disable-next-line:no-any
export function traceError(...args: any[]) {
    log(LogLevel.Error, ...args);
}

// tslint:disable-next-line:no-any
export function traceInfo(...args: any[]) {
    log(LogLevel.Info, ...args);
}

// tslint:disable-next-line:no-any
export function traceWarning(...args: any[]) {
    log(LogLevel.Warn, ...args);
}

export namespace traceDecorators {
    const DEFAULT_OPTS: TraceOptions = TraceOptions.Arguments | TraceOptions.ReturnValue;

    function trace(logInfo: LogInfo) {
        return traceDecorator((call, traced) => logResult(logInfo, traced, call));
    }

    export function verbose(message: string, opts: TraceOptions = DEFAULT_OPTS) {
        return trace({ message, opts });
    }
    export function error(message: string) {
        const opts = DEFAULT_OPTS;
        const level = LogLevel.Error;
        return trace({ message, opts, level });
    }
    export function info(message: string) {
        const opts = TraceOptions.None;
        return trace({ message, opts });
    }
    export function warn(message: string) {
        const opts = DEFAULT_OPTS;
        const level = LogLevel.Warn;
        return trace({ message, opts, level });
    }
}

// This is like a "context manager" that logs tracing info.
export function tracing<T>(logInfo: LogInfo, run: () => T, call?: CallInfo): T {
    return _tracing((traced) => logResult(logInfo, traced, call), run);
}

type LogInfo = {
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
        `has a ${traced.returnValue ? 'truthy' : 'falsy'} return value`
    );
    if ((info.opts & TraceOptions.Arguments) === TraceOptions.Arguments) {
        messages.push(argsToLogString(call.args));
    }
    if ((info.opts & TraceOptions.ReturnValue) === TraceOptions.ReturnValue) {
        messages.push(returnValueToLogString(traced.returnValue));
    }
    return messages.join(', ');
}

function logResult(info: LogInfo, traced: TraceInfo, call?: CallInfo) {
    const formatted = formatMessages(info, traced, call);
    if (traced.err === undefined) {
        // The call did not fail.
        if (!info.level || info.level > LogLevel.Error) {
            log(LogLevel.Info, formatted);
        }
    } else {
        log(LogLevel.Error, formatted, traced.err);
        // tslint:disable-next-line:no-any
        sendTelemetryEvent('ERROR' as any, undefined, undefined, traced.err);
    }
}
