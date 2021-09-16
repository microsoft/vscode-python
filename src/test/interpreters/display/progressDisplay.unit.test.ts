// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { anything, capture, instance, mock, when } from 'ts-mockito';
import { CancellationToken, Disposable, Progress, ProgressOptions } from 'vscode';
import { ApplicationShell } from '../../../client/common/application/applicationShell';
import { ExperimentService } from '../../../client/common/experiments/service';
import { Interpreters } from '../../../client/common/utils/localize';
import { noop } from '../../../client/common/utils/misc';
import { IComponentAdapter, IInterpreterLocatorProgressService } from '../../../client/interpreter/contracts';
import { InterpreterLocatorProgressStatubarHandler } from '../../../client/interpreter/display/progressDisplay';
import { ServiceContainer } from '../../../client/ioc/container';
import { IServiceContainer } from '../../../client/ioc/types';

type ProgressTask<R> = (
    progress: Progress<{ message?: string; increment?: number }>,
    token: CancellationToken,
) => Thenable<R>;

suite('Interpreters - Display Progress', () => {
    let refreshingCallback: (e: void) => unknown | undefined;
    let refreshedCallback: (e: void) => unknown | undefined;
    const progressService: IInterpreterLocatorProgressService = {
        onRefreshing(listener: (e: void) => unknown): Disposable {
            refreshingCallback = listener;
            return { dispose: noop };
        },
        onRefreshed(listener: (e: void) => unknown): Disposable {
            refreshedCallback = listener;
            return { dispose: noop };
        },
        activate(): Promise<void> {
            return Promise.resolve();
        },
    };
    let serviceContainer: IServiceContainer;

    setup(() => {
        serviceContainer = mock(ServiceContainer);
        when(serviceContainer.get<IInterpreterLocatorProgressService>(IInterpreterLocatorProgressService)).thenReturn(
            progressService,
        );
    });

    test('Display loading message when refreshing interpreters for the first time', async () => {
        const shell = mock(ApplicationShell);
        const statusBar = new InterpreterLocatorProgressStatubarHandler(
            instance(shell),
            instance(serviceContainer),
            [],
            instance(mock(IComponentAdapter)),
            instance(mock(ExperimentService)),
        );
        when(shell.withProgress(anything(), anything())).thenResolve();

        await statusBar.activate();
        refreshingCallback(undefined);

        const options = capture(shell.withProgress as never).last()[0] as ProgressOptions;
        expect(options.title).to.be.equal(Interpreters.discovering());
    });

    test('Display refreshing message when refreshing interpreters for the second time', async () => {
        const shell = mock(ApplicationShell);
        const statusBar = new InterpreterLocatorProgressStatubarHandler(
            instance(shell),
            instance(serviceContainer),
            [],
            instance(mock(IComponentAdapter)),
            instance(mock(ExperimentService)),
        );
        when(shell.withProgress(anything(), anything())).thenResolve();

        await statusBar.activate();
        refreshingCallback(undefined);

        let options = capture(shell.withProgress as never).last()[0] as ProgressOptions;
        expect(options.title).to.be.equal(Interpreters.discovering());

        refreshingCallback(undefined);

        options = capture(shell.withProgress as never).last()[0] as ProgressOptions;
        expect(options.title).to.be.equal(Interpreters.refreshing());
    });

    test('Progress message is hidden when loading has completed', async () => {
        const shell = mock(ApplicationShell);
        const statusBar = new InterpreterLocatorProgressStatubarHandler(
            instance(shell),
            instance(serviceContainer),
            [],
            instance(mock(IComponentAdapter)),
            instance(mock(ExperimentService)),
        );
        when(shell.withProgress(anything(), anything())).thenResolve();

        await statusBar.activate();
        refreshingCallback(undefined);

        const options = capture(shell.withProgress as never).last()[0] as ProgressOptions;
        const callback = capture(shell.withProgress as never).last()[1] as ProgressTask<void>;
        const promise = callback(undefined as never, undefined as never);

        expect(options.title).to.be.equal(Interpreters.discovering());

        refreshedCallback(undefined);
        // Promise must resolve when refreshed callback is invoked.
        // When promise resolves, the progress message is hidden by VSC.
        await promise;
    });
});
