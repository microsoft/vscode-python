// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { anything, deepEqual, instance, mock, verify } from 'ts-mockito';
import { createDeferred } from '../../../client/common/utils/async';
import { disposeRegisteredReporters, registerReporter, reportAction } from '../../../client/datascience/progress/decorator';
import { ProgressReporter } from '../../../client/datascience/progress/progressReporter';
import { IProgressReporter, ReportableAction } from '../../../client/datascience/progress/types';
import { noop } from '../../core';

suite('Data Science - Progress Reporter Decorator', () => {
    let reporter: IProgressReporter;

    class SomeClassThatDoesSomething {
        public readonly something = createDeferred();
        public readonly somethingElse = createDeferred();
        @reportAction(ReportableAction.NotebookStart)
        public async doSomething() {
            return this.something.promise;
        }
        @reportAction(ReportableAction.NotebookConnect)
        public async doSomethingElse() {
            return this.somethingElse.promise;
        }
    }
    class AnotherClassThatDoesSomething {
        public readonly something = createDeferred();
        public readonly somethingElse = createDeferred();
        @reportAction(ReportableAction.JupyterSessionWaitForIdleSession)
        public async doSomething() {
            return this.something.promise;
        }
        @reportAction(ReportableAction.KernelsGetKernelForRemoteConnection)
        public async doSomethingElse() {
            return this.somethingElse.promise;
        }
    }
    setup(() => {
        reporter = mock(ProgressReporter);
        registerReporter(instance(reporter));
    });
    teardown(disposeRegisteredReporters);

    test('Report Progress', async () => {
        const cls1 = new SomeClassThatDoesSomething();
        const cls2 = new AnotherClassThatDoesSomething();

        verify(reporter.report(anything())).never();

        // Report progress of actions started.
        cls1.doSomething().ignoreErrors();
        cls2.doSomething().ignoreErrors();

        verify(reporter.report(anything())).times(2);
        verify(reporter.report(deepEqual({ action: ReportableAction.NotebookStart, phase: 'started' }))).once();
        verify(reporter.report(deepEqual({ action: ReportableAction.JupyterSessionWaitForIdleSession, phase: 'started' }))).once();

        // Report progress of actions completed (even if promises get rejected).
        cls1.something.resolve();
        cls2.something.reject(new Error('Kaboom'));
        await Promise.all([cls1.something.promise.catch(noop), cls2.something.promise.catch(noop)]);

        verify(reporter.report(anything())).times(4);
        verify(reporter.report(deepEqual({ action: ReportableAction.NotebookStart, phase: 'completed' }))).once();
        verify(reporter.report(deepEqual({ action: ReportableAction.JupyterSessionWaitForIdleSession, phase: 'completed' }))).once();

        // Report progress of actions started again.
        cls1.doSomethingElse().ignoreErrors();
        cls2.doSomethingElse().ignoreErrors();

        verify(reporter.report(anything())).times(6);
        verify(reporter.report(deepEqual({ action: ReportableAction.NotebookConnect, phase: 'started' }))).once();
        verify(reporter.report(deepEqual({ action: ReportableAction.KernelsGetKernelForRemoteConnection, phase: 'started' }))).once();

        // Report progress of actions completed (even if promises get rejected).
        cls1.somethingElse.resolve();
        cls2.somethingElse.reject(new Error('Kaboom'));
        await Promise.all([cls1.somethingElse.promise.catch(noop), cls2.somethingElse.promise.catch(noop)]);

        verify(reporter.report(anything())).times(8);
        verify(reporter.report(deepEqual({ action: ReportableAction.NotebookConnect, phase: 'completed' }))).once();
        verify(reporter.report(deepEqual({ action: ReportableAction.KernelsGetKernelForRemoteConnection, phase: 'completed' }))).once();
    });
});
