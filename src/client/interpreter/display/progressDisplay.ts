// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Disposable, ProgressLocation, ProgressOptions } from 'vscode';
import { IExtensionSingleActivationService } from '../../activation/types';
import { IApplicationShell } from '../../common/application/types';
import { inDiscoveryExperiment } from '../../common/experiments/helpers';
import { traceDecorators } from '../../common/logger';
import { IDisposableRegistry, IExperimentService } from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import { Interpreters } from '../../common/utils/localize';
import { IServiceContainer } from '../../ioc/types';
import { IComponentAdapter, IInterpreterLocatorProgressService } from '../contracts';

// The parts of IComponentAdapter used here.
@injectable()
export class InterpreterLocatorProgressStatubarHandler implements IExtensionSingleActivationService {
    private deferred: Deferred<void> | undefined;

    private isFirstTimeLoadingInterpreters = true;

    constructor(
        @inject(IApplicationShell) private readonly shell: IApplicationShell,
        @inject(IServiceContainer)
        private readonly serviceContainer: IServiceContainer,
        @inject(IDisposableRegistry) private readonly disposables: Disposable[],
        @inject(IComponentAdapter) private readonly pyenvs: IComponentAdapter,
        @inject(IExperimentService) private readonly experimentService: IExperimentService,
    ) {}

    public async activate(): Promise<void> {
        if (await inDiscoveryExperiment(this.experimentService)) {
            this.pyenvs.onRefreshStart(
                () => {
                    this.showProgress();
                    if (this.pyenvs.refreshPromise) {
                        this.pyenvs.refreshPromise.then(() => this.hideProgress());
                    }
                },
                this,
                this.disposables,
            );
        } else {
            const progressService = this.serviceContainer.get<IInterpreterLocatorProgressService>(
                IInterpreterLocatorProgressService,
            );
            progressService.onRefreshing(() => this.showProgress(), this, this.disposables);
            progressService.onRefreshed(() => this.hideProgress(), this, this.disposables);
        }
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
            title: this.isFirstTimeLoadingInterpreters ? Interpreters.discovering() : Interpreters.refreshing(),
        };
        this.isFirstTimeLoadingInterpreters = false;
        this.shell.withProgress(progressOptions, () => {
            this.deferred = createDeferred();
            return this.deferred.promise;
        });
    }
}
