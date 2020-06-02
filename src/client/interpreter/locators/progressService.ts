// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Disposable, Event, EventEmitter } from 'vscode';
import { traceDecorators } from '../../common/logger';
import { IDisposableRegistry } from '../../common/types';
import { createDeferredFrom, Deferred } from '../../common/utils/async';
import { noop } from '../../common/utils/misc';
import { IServiceContainer } from '../../ioc/types';
import { PythonInterpreter } from '../../pythonEnvironments/discovery/types';
import { IInterpreterLocatorProgressService, IInterpreterLocatorService } from '../contracts';

@injectable()
export class InterpreterLocatorProgressService implements IInterpreterLocatorProgressService {
    private deferreds: Deferred<PythonInterpreter[]>[] = [];
    private readonly refreshing = new EventEmitter<void>();
    private readonly refreshed = new EventEmitter<void>();
    private readonly locators: IInterpreterLocatorService[] = [];
    constructor(
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(IDisposableRegistry) private readonly disposables: Disposable[]
    ) {
        this.locators = serviceContainer.getAll<IInterpreterLocatorService>(IInterpreterLocatorService);
    }

    public get onRefreshing(): Event<void> {
        return this.refreshing.event;
    }
    public get onRefreshed(): Event<void> {
        return this.refreshed.event;
    }
    public register(): void {
        this.locators.forEach((locator) => {
            locator.onLocating(this.handleProgress, this, this.disposables);
        });
    }
    @traceDecorators.verbose('Detected refreshing of Interpreters')
    private handleProgress(promise: Promise<PythonInterpreter[]>) {
        this.deferreds.push(createDeferredFrom(promise));
        this.notifyRefreshing();
        this.checkProgress();
    }
    @traceDecorators.verbose('All locators have completed locating')
    private notifyCompleted() {
        this.refreshed.fire();
    }
    @traceDecorators.verbose('Notify locators are locating')
    private notifyRefreshing() {
        this.refreshing.fire();
    }
    private checkProgress() {
        if (this.deferreds.length === 0) {
            return;
        }
        if (this.areAllItemsComplete()) {
            return this.notifyCompleted();
        }
        Promise.all(this.deferreds.map((item) => item.promise))
            .catch(noop)
            .then(() => this.checkProgress())
            .ignoreErrors();
    }
    @traceDecorators.verbose('Checking whether locactors have completed locating')
    private areAllItemsComplete() {
        this.deferreds = this.deferreds.filter((item) => !item.completed);
        return this.deferreds.length === 0;
    }
}
