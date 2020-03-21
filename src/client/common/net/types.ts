// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

export type RequestProgressState = {
    percent: number;
    speed: number;
    size: {
        total: number;
        transferred: number;
    };
    time: {
        elapsed: number;
        remaining: number;
    };
};
