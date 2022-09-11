// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CancellationToken, QuickPickItem, QuickPickOptions, window } from 'vscode';

export function showQuickPick<T extends QuickPickItem>(
    items: readonly T[] | Thenable<readonly T[]>,
    options?: QuickPickOptions,
    token?: CancellationToken,
): Thenable<T | undefined> {
    return window.showQuickPick(items, options, token);
}
