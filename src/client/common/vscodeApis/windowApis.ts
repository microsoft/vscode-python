// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {
    CancellationToken,
    MessageItem,
    MessageOptions,
    Progress,
    ProgressOptions,
    QuickPickItem,
    QuickPickOptions,
    window,
} from 'vscode';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function showQuickPick<T extends QuickPickItem>(
    items: readonly T[] | Thenable<readonly T[]>,
    options?: QuickPickOptions,
    token?: CancellationToken,
): Thenable<T | undefined> {
    return window.showQuickPick(items, options, token);
}

export function showErrorMessage<T extends string>(message: string, ...items: T[]): Thenable<T | undefined>;
export function showErrorMessage<T extends string>(
    message: string,
    options: MessageOptions,
    ...items: T[]
): Thenable<T | undefined>;
export function showErrorMessage<T extends MessageItem>(message: string, ...items: T[]): Thenable<T | undefined>;
export function showErrorMessage<T extends MessageItem>(
    message: string,
    options: MessageOptions,
    ...items: T[]
): Thenable<T | undefined>;

export function showErrorMessage<T>(message: string, ...items: any[]): Thenable<T | undefined> {
    return window.showErrorMessage(message, ...items);
}

export function withProgress<R>(
    options: ProgressOptions,
    task: (progress: Progress<{ message?: string; increment?: number }>, token: CancellationToken) => Thenable<R>,
): Thenable<R> {
    return window.withProgress(options, task);
}
