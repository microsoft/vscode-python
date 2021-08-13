// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const _itemsToRun: (() => void)[] = [];
let _activationCompleted = false;

export function addItemsToRun(run: () => void): void {
    if (_activationCompleted) {
        run();
    } else {
        _itemsToRun.push(run);
    }
}

export function runAfterActivation(): void {
    _activationCompleted = true;
    while (_itemsToRun.length > 0) {
        const run = _itemsToRun.shift();
        if (run) {
            run();
        }
    }
}
