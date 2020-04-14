// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

// The various supported log levels.  The number value matches (npm) winston.
export enum LogLevel {
    Error = 0,
    Warning = 1,
    Information = 2
}

// The information we want to log.
export enum TraceOptions {
    None = 0,
    Arguments = 1,
    ReturnValue = 2
}
