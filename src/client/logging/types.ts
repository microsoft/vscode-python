// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */

export type LoggingLevelSettingType = 'off' | 'error' | 'warn' | 'info' | 'debug';
export enum LogLevel {
    Off = 0,
    Error = 10,
    Warn = 20,
    Info = 30,
    Debug = 40,
}

export type Arguments = unknown[];

export interface ILogging {
    traceError(...data: Arguments): void;
    traceWarn(...data: Arguments): void;
    traceInfo(...data: Arguments): void;
    traceVerbose(...data: Arguments): void;
}

export type TraceDecoratorType = (
    _: Object,
    __: string,
    descriptor: TypedPropertyDescriptor<any>,
) => TypedPropertyDescriptor<any>;

// The information we want to log.
export enum TraceOptions {
    None = 0,
    Arguments = 1,
    ReturnValue = 2,
}
