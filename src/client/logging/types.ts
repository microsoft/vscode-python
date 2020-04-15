// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

// Knobs used when creating a formatter.
export type FormatterOptions = {
    label?: string;
};

// The information we want to log.
export enum TraceOptions {
    None = 0,
    Arguments = 1,
    ReturnValue = 2
}
