// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

export type RetryTimeoutOptions = { timeout: number; interval?: number };
export type RetryCounterOptions = { count: number; interval?: number };
export type RetryOptions = RetryTimeoutOptions | RetryCounterOptions;

export type AsyncFunction = AsyncFunctinoNoArgsAny | AsyncFunctinoNoArgsVoid | AsyncFunctionAny | AsyncFunctionVoid;
type AsyncFunctinoNoArgsAny = () => Promise<{}>;
type AsyncFunctinoNoArgsVoid = () => Promise<void>;
type AsyncFunctionAny = (...any: {}[]) => Promise<{}>;
type AsyncFunctionVoid = (...any: {}[]) => Promise<void>;
