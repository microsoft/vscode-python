// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import { Disposable, ProgressLocation, ProgressOptions } from 'vscode';

import { IApplicationShell } from '../common/application/types';
import { createDeferred, Deferred } from '../common/utils/async';
import { HistoryMessages } from './constants';
import { IHistoryProvider, IStatusProvider } from './types';

class StatusItem implements Disposable {

    private deferred : Deferred<void>;
    private disposed: boolean = false;
    private timeout: NodeJS.Timer | undefined;
    private disposeCallback: () => void;

    constructor(title: string, disposeCallback: () => void, timeout?: number) {
        this.deferred = createDeferred<void>();
        this.disposeCallback = disposeCallback;

        // A timeout is possible too. Auto dispose if that's the case
        if (timeout) {
            this.timeout = setTimeout(this.dispose, timeout);
        }
    }

    public dispose = () => {
        if (!this.disposed) {
            this.disposed = true;
            if (this.timeout) {
                clearTimeout(this.timeout);
                this.timeout = undefined;
            }
            this.disposeCallback();
            if (!this.deferred.completed) {
                this.deferred.resolve();
            }
        }
    }

    public promise = () : Promise<void> => {
        return this.deferred.promise;
    }

    public reject = () => {
        this.deferred.reject();
        this.dispose();
    }

}

@injectable()
export class StatusProvider implements IStatusProvider {
    private statusCount : number = 0;

    constructor(
        @inject(IApplicationShell) private applicationShell: IApplicationShell,
        @inject(IHistoryProvider) private historyProvider: IHistoryProvider) {
    }

    public set(message: string, timeout?: number, cancel?: () => void) : Disposable {
        // Start our progress
        this.incrementCount();

        // Create a StatusItem that will return our promise
        const statusItem = new StatusItem(message, () => this.decrementCount(), timeout);

        const progressOptions: ProgressOptions = {
            location: cancel ? ProgressLocation.Notification : ProgressLocation.Window,
            title: message,
            cancellable: cancel !== undefined
        };

        // Set our application shell status with a busy icon
        this.applicationShell.withProgress(
            progressOptions,
            (p, c) =>
            {
                if (c && cancel) {
                    c.onCancellationRequested(() => {
                        cancel();
                        statusItem.reject();
                    });
                }
                return statusItem.promise();
            }
        );

        return statusItem;
    }

    public async waitWithStatus<T>(promise: () => Promise<T>, message: string, timeout?: number, cancel?: () => void) : Promise<T> {
        // Create a status item and wait for our promise to either finish or reject
        const status = this.set(message, timeout, cancel);
        let result : T;
        try {
            result = await promise();
        } finally {
            status.dispose();
        }
        return result;
    }

    private incrementCount = () => {
        if (this.statusCount === 0) {
            const history = this.historyProvider.getActive();
            if (history) {
                history.postMessage(HistoryMessages.StartProgress);
            }
        }
        this.statusCount += 1;
    }

    private decrementCount = () => {
        const updatedCount = this.statusCount - 1;
        if (updatedCount === 0) {
            const history = this.historyProvider.getActive();
            if (history) {
                history.postMessage(HistoryMessages.StopProgress);
            }
        }
        this.statusCount = Math.max(updatedCount, 0);
    }

}
