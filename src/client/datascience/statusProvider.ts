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
    private history : IHistory;
    private disposed: boolean = false;

    constructor(title: string, history: IHistory, timeout?: number) {
        this.history = history;
        this.deferred = createDeferred<void>();

        if (this.history !== null) {
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
            if (this.history !== null) {
                this.history.postMessage(HistoryMessages.StopProgress);
            }
            this.deferred.resolve();
        }
    }

    public promise = () : Promise<void> => {
        return this.deferred.promise;
    }

}

@injectable()
export class StatusProvider implements IStatusProvider {

    constructor(
        @inject(IApplicationShell) private applicationShell: IApplicationShell) {

    }

    public set(message: string, history: IHistory, timeout?: number) : Disposable {
        // Create a StatusItem that will return our promise
        const statusItem = new StatusItem(message, history, timeout);

        const progressOptions: ProgressOptions = {
            location: ProgressLocation.Window,
            title: message
        };

        // Set our application shell status with a busy icon
        this.applicationShell.withProgress(
            progressOptions,
            () => { return statusItem.promise(); }
        );

        return statusItem;
    }

}
