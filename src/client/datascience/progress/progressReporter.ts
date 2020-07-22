// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { CancellationToken, CancellationTokenSource, Progress as VSCProgress, ProgressLocation } from 'vscode';
import { IApplicationShell } from '../../common/application/types';
import { IDisposable } from '../../common/types';
import { createDeferred } from '../../common/utils/async';
import { noop } from '../../common/utils/misc';
import { registerReporter } from './decorator';
import { getUserMessageForAction } from './messages';
import { IProgressReporter, Progress, ReportableAction } from './types';

@injectable()
export class ProgressReporter implements IProgressReporter {
    private progressReporters: VSCProgress<{ message?: string | undefined; increment?: number | undefined }>[] = [];
    private actionPhases = new Map<ReportableAction, 'started' | 'completed'>();
    private currentActions: ReportableAction[] = [];
    private get currentAction(): ReportableAction | undefined {
        return this.currentActions.length === 0 ? undefined : this.currentActions[this.currentActions.length - 1];
    }

    constructor(@inject(IApplicationShell) private readonly appShell: IApplicationShell) {
        registerReporter(this);
    }

    /**
     * Create and display a progress indicator for starting of Jupyter Notebooks.
     *
     * @param {string} message
     * @returns {(IDisposable & { token: CancellationToken })}
     * @memberof ProgressReporter
     */
    public createProgressIndicator(message: string, cancellable = false): IDisposable & { token: CancellationToken } {
        const cancellation = new CancellationTokenSource();
        const deferred = createDeferred();
        const options = { location: ProgressLocation.Notification, cancellable: cancellable, title: message };

        this.appShell
            .withProgress(options, async (progress, cancelToken) => {
                cancelToken.onCancellationRequested(() => {
                    if (cancelToken.isCancellationRequested) {
                        cancellation.cancel();
                    }
                    deferred.resolve();
                });
                cancellation.token.onCancellationRequested(() => {
                    deferred.resolve();
                });
                this.progressReporters.push(progress);
                await deferred.promise;
            })
            .then(noop, noop);

        return {
            token: cancellation.token,
            dispose: () => deferred.resolve()
        };
    }

    /**
     * Reports progress to the user.
     * Keep messages in a stack. As we have new actions taking place place them in a stack and notify progress.
     * As they finish pop them from the stack (if currently displayed).
     * We need a stack, as we have multiple async actions taking place, and each stat & can complete at different times.
     *
     * @param {Progress} progress
     * @returns {void}
     * @memberof JupyterStartupProgressReporter
     */
    public report(progress: Progress): void {
        if (this.progressReporters.length === 0) {
            return;
        }
        this.actionPhases.set(progress.action, progress.phase);

        if (progress.phase === 'started') {
            this.currentActions.push(progress.action);
        }

        if (!this.currentAction) {
            return;
        }

        // If current action has been completed, then pop that item.
        // Until we have an action that is still in progress
        while (this.actionPhases.get(this.currentAction) && this.actionPhases.get(this.currentAction) !== 'started') {
            this.actionPhases.delete(this.currentAction);
            this.currentActions.pop();
        }

        this.updateProgressMessage();
    }

    private updateProgressMessage() {
        if (!this.currentAction || this.progressReporters.length === 0) {
            return;
        }
        const message = getUserMessageForAction(this.currentAction);
        if (message) {
            this.progressReporters.forEach((item) => item.report({ message }));
        }
    }
}
