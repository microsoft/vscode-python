// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import { Disposable, ProgressLocation, ProgressOptions } from 'vscode';

import { IApplicationShell } from '../common/application/types';
import { createDeferred, Deferred } from '../common/utils/async';
import { HistoryMessages } from './constants';
import { IHistory, IStatusProvider } from './types';

class StatusItem implements Disposable {

    private deferred : Deferred<void>;
    private history : IHistory | undefined;
    private disposed: boolean = false;

    constructor(title: string, history?: IHistory, timeout?: number) {
        this.history = history;
        this.deferred = createDeferred<void>();

        if (this.history) {
            this.history.postMessage(HistoryMessages.StartProgress, title);
        }

        // A timeout is possible too. Auto dispose if that's the case
        if (timeout) {
            setTimeout(this.dispose, timeout);
        }
    }

    public dispose = () => {
        if (!this.disposed) {
            this.disposed = true;
            if (this.history) {
                this.history!.postMessage(HistoryMessages.StopProgress);
            }
            this.deferred.resolve();
        }
    }

    public promise = () : Promise<void> => {
        return this.deferred.promise;
    }

    public reject = () => {
        this.deferred.reject();
    }

}

@injectable()
export class StatusProvider implements IStatusProvider {

    constructor(
        @inject(IApplicationShell) private applicationShell: IApplicationShell) {

    }

    public set(message: string, history?: IHistory, timeout?: number, cancel?: () => void) : Disposable {
        // Create a StatusItem that will return our promise
        const statusItem = new StatusItem(message, history, timeout);

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

    public async waitWithStatus<T>(promise: () => Promise<T>, message: string, history?: IHistory, timeout?: number, cancel?: () => void) : Promise<T> {
        // Create a status item and wait for our promise to either finish or reject
        const status = this.set(message, history, timeout, cancel);
        let result : T;
        try {
            result = await promise();
        } finally {
            status.dispose();
        }
        return result;
    }

}
