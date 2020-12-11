// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Disposable, Event, ProgressLocation, ProgressOptions } from 'vscode';
import { IApplicationShell } from '../../common/application/types';
import { traceDecorators } from '../../common/logger';
import { IDisposableRegistry } from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import { Common, Interpreters } from '../../common/utils/localize';
import {
    IComponentAdapter,
    IInterpreterLocatorProgressHandler,
    IInterpreterLocatorProgressService
} from '../contracts';

// The parts of IComponentAdapter used here.
export interface IComponent {
    readonly onRefreshing: Event<void> | undefined;
    readonly onRefreshed: Event<void> | undefined;
}
@injectable()
export class InterpreterLocatorProgressStatubarHandler implements IInterpreterLocatorProgressHandler {
    private deferred: Deferred<void> | undefined;
    private isFirstTimeLoadingInterpreters = true;
    constructor(
        @inject(IApplicationShell) private readonly shell: IApplicationShell,
        @inject(IInterpreterLocatorProgressService)
        private readonly progressService: IInterpreterLocatorProgressService,
        @inject(IDisposableRegistry) private readonly disposables: Disposable[],
        @inject(IComponentAdapter) private readonly pyenvs: IComponent
    ) {}
    public register() {
        const onRefreshing = this.pyenvs.onRefreshing ?? this.progressService.onRefreshing;
        const onRefreshed = this.pyenvs.onRefreshed ?? this.progressService.onRefreshed;
        onRefreshing(() => this.showProgress(), this, this.disposables);
        onRefreshed(() => this.hideProgress(), this, this.disposables);
    }
    @traceDecorators.verbose('Display locator refreshing progress')
    private showProgress(): void {
        if (!this.deferred) {
            this.createProgress();
        }
    }
    @traceDecorators.verbose('Hide locator refreshing progress')
    private hideProgress(): void {
        if (this.deferred) {
            this.deferred.resolve();
            this.deferred = undefined;
        }
    }
    private createProgress() {
        const progressOptions: ProgressOptions = {
            location: ProgressLocation.Window,
            title: this.isFirstTimeLoadingInterpreters ? Common.loadingExtension() : Interpreters.refreshing()
        };
        this.isFirstTimeLoadingInterpreters = false;
        this.shell.withProgress(progressOptions, () => {
            this.deferred = createDeferred();
            return this.deferred.promise;
        });
    }
}
