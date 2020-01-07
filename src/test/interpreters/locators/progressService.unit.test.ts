// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-classes-per-file max-func-body-length

import { expect } from 'chai';
import { anything, instance, mock, when } from 'ts-mockito';
import { Disposable, Uri } from 'vscode';
import { createDeferred } from '../../../client/common/utils/async';
import { noop } from '../../../client/common/utils/misc';
import { IInterpreterLocatorService, PythonInterpreter } from '../../../client/interpreter/contracts';
import { InterpreterLocatorProgressService } from '../../../client/interpreter/locators/progressService';
import { ServiceContainer } from '../../../client/ioc/container';
import { sleep } from '../../core';

suite('Interpreters - Locator Progress', () => {
    class Locator implements IInterpreterLocatorService {
        public get hasInterpreters(): Promise<boolean> {
            return Promise.resolve(true);
        }
        public locatingCallback?: (e: Promise<PythonInterpreter[]>) => any;
        public onLocating(listener: (e: Promise<PythonInterpreter[]>) => any, _thisArgs?: any, _disposables?: Disposable[]): Disposable {
            this.locatingCallback = listener;
            return { dispose: noop };
        }
        public getInterpreters(_resource?: Uri): Promise<PythonInterpreter[]> {
            return Promise.resolve([]);
        }
        public dispose() {
            noop();
        }
    }

    test('Must raise refreshing event', async () => {
        const serviceContainer = mock(ServiceContainer);
        const locator = new Locator();
        when(serviceContainer.getAll(anything())).thenReturn([locator]);
        const progress = new InterpreterLocatorProgressService(instance(serviceContainer), []);
        progress.register();

        let refreshingInvoked = false;
        progress.onRefreshing(() => (refreshingInvoked = true));
        let refreshedInvoked = false;
        progress.onRefreshed(() => (refreshedInvoked = true));

        const locatingDeferred = createDeferred<PythonInterpreter[]>();
        locator.locatingCallback!.bind(progress)(locatingDeferred.promise);
        expect(refreshingInvoked).to.be.equal(true, 'Refreshing Not invoked');
        expect(refreshedInvoked).to.be.equal(false, 'Refreshed invoked');
    });
    test('Must raise refreshed event', async () => {
        const serviceContainer = mock(ServiceContainer);
        const locator = new Locator();
        when(serviceContainer.getAll(anything())).thenReturn([locator]);
        const progress = new InterpreterLocatorProgressService(instance(serviceContainer), []);
        progress.register();

        let refreshingInvoked = false;
        progress.onRefreshing(() => (refreshingInvoked = true));
        let refreshedInvoked = false;
        progress.onRefreshed(() => (refreshedInvoked = true));

        const locatingDeferred = createDeferred<PythonInterpreter[]>();
        locator.locatingCallback!.bind(progress)(locatingDeferred.promise);
        locatingDeferred.resolve();

        await sleep(10);
        expect(refreshingInvoked).to.be.equal(true, 'Refreshing Not invoked');
        expect(refreshedInvoked).to.be.equal(true, 'Refreshed not invoked');
    });
    test('Must raise refreshed event only when all locators have completed', async () => {
        const serviceContainer = mock(ServiceContainer);
        const locator1 = new Locator();
        const locator2 = new Locator();
        const locator3 = new Locator();
        when(serviceContainer.getAll(anything())).thenReturn([locator1, locator2, locator3]);
        const progress = new InterpreterLocatorProgressService(instance(serviceContainer), []);
        progress.register();

        let refreshingInvoked = false;
        progress.onRefreshing(() => (refreshingInvoked = true));
        let refreshedInvoked = false;
        progress.onRefreshed(() => (refreshedInvoked = true));

        const locatingDeferred1 = createDeferred<PythonInterpreter[]>();
        locator1.locatingCallback!.bind(progress)(locatingDeferred1.promise);

        const locatingDeferred2 = createDeferred<PythonInterpreter[]>();
        locator2.locatingCallback!.bind(progress)(locatingDeferred2.promise);

        const locatingDeferred3 = createDeferred<PythonInterpreter[]>();
        locator3.locatingCallback!.bind(progress)(locatingDeferred3.promise);

        locatingDeferred1.resolve();

        await sleep(10);
        expect(refreshingInvoked).to.be.equal(true, 'Refreshing Not invoked');
        expect(refreshedInvoked).to.be.equal(false, 'Refreshed invoked');

        locatingDeferred2.resolve();

        await sleep(10);
        expect(refreshedInvoked).to.be.equal(false, 'Refreshed invoked');

        locatingDeferred3.resolve();

        await sleep(10);
        expect(refreshedInvoked).to.be.equal(true, 'Refreshed not invoked');
    });
});
