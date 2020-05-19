// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IExtensionActivationService } from '../../activation/types';
import { LocalZMQKernel } from '../../common/experimentGroups';
import '../../common/extensions';
import { IDisposableRegistry, IExperimentsManager, Resource } from '../../common/types';
import { swallowExceptions } from '../../common/utils/decorators';
import {
    IInteractiveWindowProvider,
    INotebookAndInteractiveWindowUsageTracker,
    INotebookEditorProvider
} from '../types';
import { KernelDaemonPool } from './kernelDaemonPool';

@injectable()
export class KernelDaemonPreWarmer implements IExtensionActivationService {
    constructor(
        @inject(INotebookEditorProvider) private readonly notebookEditorProvider: INotebookEditorProvider,
        @inject(IInteractiveWindowProvider) private interactiveProvider: IInteractiveWindowProvider,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
        @inject(INotebookAndInteractiveWindowUsageTracker)
        private readonly usageTracker: INotebookAndInteractiveWindowUsageTracker,
        @inject(KernelDaemonPool) private readonly kernelDaemonPool: KernelDaemonPool,
        @inject(IExperimentsManager) private readonly experimentsManager: IExperimentsManager
    ) {}
    public async activate(_resource: Resource): Promise<void> {
        if (!this.experimentsManager.inExperiment(LocalZMQKernel.experiment)) {
            return;
        }
        this.disposables.push(this.notebookEditorProvider.onDidOpenNotebookEditor(this.preWarmKernelDaemonPool, this));
        this.disposables.push(
            this.interactiveProvider.onDidChangeActiveInteractiveWindow(this.preWarmKernelDaemonPool, this)
        );
        if (this.notebookEditorProvider.editors.length > 0 || this.interactiveProvider.getActive()) {
            await this.preWarmKernelDaemonPool();
        }
        await this.preWarmDaemonPoolIfNecesary();
    }
    private async preWarmDaemonPoolIfNecesary() {
        if (
            this.shouldPreWarmDaemonPool(this.usageTracker.lastInteractiveWindowOpened) ||
            this.shouldPreWarmDaemonPool(this.usageTracker.lastNotebookOpened)
        ) {
            await this.preWarmKernelDaemonPool();
        }
    }
    @swallowExceptions('PreWarmKernelDaemon')
    private async preWarmKernelDaemonPool() {
        await this.kernelDaemonPool.preWarmKernelDaemons();
    }
    private shouldPreWarmDaemonPool(lastTime?: Date) {
        if (!lastTime) {
            return false;
        }
        const currentTime = new Date();
        const diff = currentTime.getTime() - lastTime.getTime();
        const diffInDays = Math.floor(diff / (24 * 3600 * 1000));
        return diffInDays <= 7;
    }
}
