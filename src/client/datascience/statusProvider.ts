// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import { Disposable, ProgressLocation, ProgressOptions } from 'vscode';

import { IApplicationShell } from '../common/application/types';
import { createDeferred, Deferred } from '../common/utils/async';
import { IInteractiveBase, IStatusProvider } from './types';

class StatusItem implements Disposable {
    private deferred: Deferred<void>;
    private disposed: boolean = false;
    private timeout: NodeJS.Timer | number | undefined;
    private disposeCallback: () => void;

    constructor(_title: string, disposeCallback: () => void, timeout?: number) {
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
                // tslint:disable-next-line: no-any
                clearTimeout(this.timeout as any);
                this.timeout = undefined;
            }
            this.disposeCallback();
            if (!this.deferred.completed) {
                this.deferred.resolve();
            }
        }
    };

    public promise = (): Promise<void> => {
        return this.deferred.promise;
    };

    public reject = () => {
        this.deferred.reject();
        this.dispose();
    };
}

@injectable()
export class StatusProvider implements IStatusProvider {
    private statusCount: number = 0;

    constructor(@inject(IApplicationShell) private applicationShell: IApplicationShell) {}

    public set(message: string, showInWebView: boolean, timeout?: number, cancel?: () => void, panel?: IInteractiveBase): Disposable {
        // Start our progress
        this.incrementCount(showInWebView, panel);

        // Create a StatusItem that will return our promise
        const statusItem = new StatusItem(message, () => this.decrementCount(panel), timeout);

        const progressOptions: ProgressOptions = {
            location: cancel ? ProgressLocation.Notification : ProgressLocation.Window,
            title: message,
            cancellable: cancel !== undefined
        };

        // Set our application shell status with a busy icon
        this.applicationShell.withProgress(progressOptions, (_p, c) => {
            if (c && cancel) {
                c.onCancellationRequested(() => {
                    cancel();
                    statusItem.reject();
                });
            }
            return statusItem.promise();
        });

        return statusItem;
    }

    public async waitWithStatus<T>(
        promise: () => Promise<T>,
        message: string,
        showInWebView: boolean,
        timeout?: number,
        cancel?: () => void,
        panel?: IInteractiveBase
    ): Promise<T> {
        // Create a status item and wait for our promise to either finish or reject
        const status = this.set(message, showInWebView, timeout, cancel, panel);
        let result: T;
        try {
            result = await promise();
        } finally {
            status.dispose();
        }
        return result;
    }

    private incrementCount = (showInWebView: boolean, panel?: IInteractiveBase) => {
        if (this.statusCount === 0) {
            if (panel && showInWebView) {
                panel.startProgress();
            }
        }
        this.statusCount += 1;
    };

    private decrementCount = (panel?: IInteractiveBase) => {
        const updatedCount = this.statusCount - 1;
        if (updatedCount === 0) {
            if (panel) {
                panel.stopProgress();
            }
        }
        this.statusCount = Math.max(updatedCount, 0);
    };
}
