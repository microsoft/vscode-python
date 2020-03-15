// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { CancellationToken, CancellationTokenSource, Progress as VSCProgress } from 'vscode';
import { ApplicationShell } from '../../../client/common/application/applicationShell';
import { IApplicationShell } from '../../../client/common/application/types';
import { getUserMessageForAction } from '../../../client/datascience/progress/messages';
import { ProgressReporter } from '../../../client/datascience/progress/progressReporter';
import { ReportableAction } from '../../../client/datascience/progress/types';
import { noop, sleep } from '../../core';
type Task<R> = (
    progress: VSCProgress<{ message?: string; increment?: number }>,
    token: CancellationToken
) => Promise<R>;

// tslint:disable-next-line: max-func-body-length
suite('Data Science - Progress Reporter', () => {
    let reporter: ProgressReporter;
    let vscodeProgressReporter: VSCProgress<{ message?: string | undefined; increment?: number | undefined }>;
    let appShell: IApplicationShell;
    class VSCodeReporter {
        public report(_value: { message?: string | undefined; increment?: number | undefined }) {
            noop();
        }
    }
    setup(() => {
        appShell = mock(ApplicationShell);
        vscodeProgressReporter = mock(VSCodeReporter);
        reporter = new ProgressReporter(instance(appShell));
    });

    test('Progress message should not get cancelled', async () => {
        let callbackPromise: Promise<{}> | undefined;
        const cancel = new CancellationTokenSource();
        when(appShell.withProgress(anything(), anything())).thenCall((_, cb: Task<{}>) => {
            return (callbackPromise = cb(instance(vscodeProgressReporter), cancel.token));
        });

        reporter.createProgressIndicator('Hello World');

        // appShell.WithProgress should not complete.
        const message = await Promise.race([callbackPromise, sleep(500).then(() => 'Timeout')]);
        assert.equal(message, 'Timeout');
        verify(vscodeProgressReporter.report(anything())).never();
    });

    test('Cancel progress message when cancellation is cancelled', async () => {
        let callbackPromise: Promise<{}> | undefined;
        const cancel = new CancellationTokenSource();
        when(appShell.withProgress(anything(), anything())).thenCall((_, cb: Task<{}>) => {
            return (callbackPromise = cb(instance(vscodeProgressReporter), cancel.token));
        });

        reporter.createProgressIndicator('Hello World');

        cancel.cancel();

        // appShell.WithProgress should complete.
        await callbackPromise!;
        verify(vscodeProgressReporter.report(anything())).never();
    });

    test('Cancel progress message when disposed', async () => {
        let callbackPromise: Promise<{}> | undefined;
        const cancel = new CancellationTokenSource();
        when(appShell.withProgress(anything(), anything())).thenCall((_, cb: Task<{}>) => {
            return (callbackPromise = cb(instance(vscodeProgressReporter), cancel.token));
        });

        const disposable = reporter.createProgressIndicator('Hello World');

        disposable.dispose();

        // appShell.WithProgress should complete.
        await callbackPromise!;
        verify(vscodeProgressReporter.report(anything())).never();
    });
    test('Report progress until disposed', async () => {
        let callbackPromise: Promise<{}> | undefined;
        const cancel = new CancellationTokenSource();
        when(appShell.withProgress(anything(), anything())).thenCall((_, cb: Task<{}>) => {
            return (callbackPromise = cb(instance(vscodeProgressReporter), cancel.token));
        });

        const disposable = reporter.createProgressIndicator('Hello World');
        const progressMessages: string[] = [];
        const expectedProgressMessages: string[] = [];

        when(vscodeProgressReporter.report(anything())).thenCall((msg: { message: string }) =>
            progressMessages.push(msg.message)
        );
        // Perform an action and ensure that we display the message.

        //1. Start notebook & ensure we display notebook stating message.
        reporter.report({ action: ReportableAction.NotebookStart, phase: 'started' });
        expectedProgressMessages.push(getUserMessageForAction(ReportableAction.NotebookStart)!);

        //2. Get kernel specs & ensure we display kernel specs message.
        reporter.report({ action: ReportableAction.KernelsGetKernelSpecs, phase: 'started' });
        expectedProgressMessages.push(getUserMessageForAction(ReportableAction.KernelsGetKernelSpecs)!);

        //3. Register kernel & ensure we display registering message.
        reporter.report({ action: ReportableAction.KernelsRegisterKernel, phase: 'started' });
        expectedProgressMessages.push(getUserMessageForAction(ReportableAction.KernelsRegisterKernel)!);

        //4. Wait for idle & ensure we display registering message.
        reporter.report({ action: ReportableAction.JupyterSessionWaitForIdleSession, phase: 'started' });
        expectedProgressMessages.push(getUserMessageForAction(ReportableAction.JupyterSessionWaitForIdleSession)!);

        //5. Finish getting kernel specs, should display previous (idle) message again.
        reporter.report({ action: ReportableAction.KernelsGetKernelSpecs, phase: 'completed' });
        expectedProgressMessages.push(getUserMessageForAction(ReportableAction.JupyterSessionWaitForIdleSession)!);

        //6. Finish waiting for idle, should display the register kernel as that's still in progress.
        reporter.report({ action: ReportableAction.JupyterSessionWaitForIdleSession, phase: 'completed' });
        expectedProgressMessages.push(getUserMessageForAction(ReportableAction.KernelsRegisterKernel)!);

        //6. Finish registering kernel, should display the starting notebook as that's still in progress.
        reporter.report({ action: ReportableAction.KernelsRegisterKernel, phase: 'completed' });
        expectedProgressMessages.push(getUserMessageForAction(ReportableAction.NotebookStart)!);

        //6. Finish starting notebook, no new messages to display.
        reporter.report({ action: ReportableAction.NotebookStart, phase: 'completed' });
        verify(vscodeProgressReporter.report(anything())).times(expectedProgressMessages.length);

        // Confirm the messages were displayed in the order we expected.
        assert.equal(progressMessages.join(', '), expectedProgressMessages.join(', '));

        // appShell.WithProgress should complete.
        disposable.dispose();
        await callbackPromise!;
    });
});
