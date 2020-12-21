// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { expect } from 'chai';
import { anything, capture, instance, mock, when } from 'ts-mockito';
import { CancellationToken, Disposable, Progress, ProgressOptions } from 'vscode';
import { ApplicationShell } from '../../../client/common/application/applicationShell';
import { Common, Interpreters } from '../../../client/common/utils/localize';
import { noop } from '../../../client/common/utils/misc';
import { IComponentAdapter, IInterpreterLocatorProgressService } from '../../../client/interpreter/contracts';
import { InterpreterLocatorProgressStatubarHandler } from '../../../client/interpreter/display/progressDisplay';

type ProgressTask<R> = (
    progress: Progress<{ message?: string; increment?: number }>,
    token: CancellationToken,
) => Thenable<R>;

suite('Interpreters - Display Progress', () => {
    let refreshingCallback: (e: void) => any | undefined;
    let refreshedCallback: (e: void) => any | undefined;
    const progressService: IInterpreterLocatorProgressService = {
        onRefreshing(listener: (e: void) => any): Disposable {
            refreshingCallback = listener;
            return { dispose: noop };
        },
        onRefreshed(listener: (e: void) => any): Disposable {
            refreshedCallback = listener;
            return { dispose: noop };
        },
        register(): void {
            noop();
        },
    };

    test('Display loading message when refreshing interpreters for the first time', async () => {
        const shell = mock(ApplicationShell);
        const statusBar = new InterpreterLocatorProgressStatubarHandler(
            instance(shell),
            progressService,
            [],
            instance(mock(IComponentAdapter)),
        );
        when(shell.withProgress(anything(), anything())).thenResolve();

        statusBar.register();
        refreshingCallback(undefined);

        const options = capture(shell.withProgress as any).last()[0] as ProgressOptions;
        expect(options.title).to.be.equal(Common.loadingExtension());
    });

    test('Display refreshing message when refreshing interpreters for the second time', async () => {
        const shell = mock(ApplicationShell);
        const statusBar = new InterpreterLocatorProgressStatubarHandler(
            instance(shell),
            progressService,
            [],
            instance(mock(IComponentAdapter)),
        );
        when(shell.withProgress(anything(), anything())).thenResolve();

        statusBar.register();
        refreshingCallback(undefined);

        let options = capture(shell.withProgress as any).last()[0] as ProgressOptions;
        expect(options.title).to.be.equal(Common.loadingExtension());

        refreshingCallback(undefined);

        options = capture(shell.withProgress as any).last()[0] as ProgressOptions;
        expect(options.title).to.be.equal(Interpreters.refreshing());
    });

    test('Progress message is hidden when loading has completed', async () => {
        const shell = mock(ApplicationShell);
        const statusBar = new InterpreterLocatorProgressStatubarHandler(
            instance(shell),
            progressService,
            [],
            instance(mock(IComponentAdapter)),
        );
        when(shell.withProgress(anything(), anything())).thenResolve();

        statusBar.register();
        refreshingCallback(undefined);

        const options = capture(shell.withProgress as any).last()[0] as ProgressOptions;
        const callback = capture(shell.withProgress as any).last()[1] as ProgressTask<void>;
        const promise = callback(undefined as any, undefined as any);

        expect(options.title).to.be.equal(Common.loadingExtension());

        refreshedCallback(undefined);
        // Promise must resolve when refreshed callback is invoked.
        // When promise resolves, the progress message is hidden by VSC.
        await promise;
    });
});
