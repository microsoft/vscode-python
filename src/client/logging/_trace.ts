// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { StopWatch } from '../common/utils/stopWatch';
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

type LogInfo = {
    opts: TraceOptions;
    message: string;
    level?: LogLevel;
};

type CallInfo = {
    kind: string;
    name: string;
    // tslint:disable-next-line:no-any
    args: any[];
};

type TraceInfo = CallInfo & {
    elapsed: number;
    // tslint:disable-next-line:no-any
    returnValue?: any;
    err?: Error;
};

function formatMessages(info: LogInfo, traced: TraceInfo): string {
    const messages = [info.message];
    messages.push(
        `${traced.kind} name = ${traced.name}`.trim(),
        `completed in ${traced.elapsed}ms`,
        `has a ${traced.returnValue ? 'truthy' : 'falsy'} return value`
    );
    if ((info.opts & TraceOptions.Arguments) === TraceOptions.Arguments) {
        messages.push(argsToLogString(traced.args));
    }
    if ((info.opts & TraceOptions.ReturnValue) === TraceOptions.ReturnValue) {
        messages.push(returnValueToLogString(traced.returnValue));
    }
    return messages.join(', ');
}

function logResult(info: LogInfo, traced: TraceInfo) {
    const formatted = formatMessages(info, traced);
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

function trace(logInfo: LogInfo) {
    // tslint:disable-next-line:no-function-expression no-any
    return function (_: Object, __: string, descriptor: TypedPropertyDescriptor<any>) {
        const originalMethod = descriptor.value;
        // tslint:disable-next-line:no-function-expression no-any
        descriptor.value = function (...args: any[]) {
            const call = {
                kind: 'Class',
                name: _ && _.constructor ? _.constructor.name : '',
                args
            };
            const timer = new StopWatch();
            try {
                // tslint:disable-next-line:no-invalid-this no-use-before-declare no-unsafe-any
                const result = originalMethod.apply(this, args);
                // If method being wrapped returns a promise then wait for it.
                // tslint:disable-next-line:no-unsafe-any
                if (result && typeof result.then === 'function' && typeof result.catch === 'function') {
                    // tslint:disable-next-line:prefer-type-cast
                    (result as Promise<void>)
                        .then((data) => {
                            logResult(logInfo, { ...call, elapsed: timer.elapsedTime, returnValue: data });
                            return data;
                        })
                        .catch((ex) => {
                            logResult(logInfo, { ...call, elapsed: timer.elapsedTime, err: ex });
                        });
                } else {
                    logResult(logInfo, { ...call, elapsed: timer.elapsedTime, returnValue: result });
                }
                return result;
            } catch (ex) {
                logResult(logInfo, { ...call, elapsed: timer.elapsedTime, err: ex });
                throw ex;
            }
        };

        return descriptor;
    };
}
