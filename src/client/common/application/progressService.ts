// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ProgressLocation, ProgressOptions } from 'vscode';
import { Deferred, createDeferred } from '../utils/async';
import { IApplicationShell } from './types';

export class ProgressService {
    private deferred: Deferred<void> | undefined;

    constructor(private readonly shell: IApplicationShell, private readonly title: string) {}

    public showProgress(): void {
        if (!this.deferred) {
            this.createProgress();
        }
    }

    public hideProgress(): void {
        if (this.deferred) {
            this.deferred.resolve();
            this.deferred = undefined;
        }
    }

    private createProgress() {
        const progressOptions: ProgressOptions = {
            location: ProgressLocation.Window,
            title: this.title,
        };
        this.shell.withProgress(progressOptions, () => {
            this.deferred = createDeferred();
            return this.deferred.promise;
        });
    }
}
