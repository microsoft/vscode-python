// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IExtensionActivationService } from '../../activation/types';
import '../../common/extensions';
import { IConfigurationService, IDisposableRegistry, Resource } from '../../common/types';
import { swallowExceptions } from '../../common/utils/decorators';
import {
    IInteractiveWindowProvider,
    INotebookAndInteractiveWindowUsageTracker,
    INotebookEditorProvider,
    IRawNotebookSupportedService
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
        @inject(IRawNotebookSupportedService) private readonly rawNotebookSupported: IRawNotebookSupportedService,
        @inject(IConfigurationService) private readonly configService: IConfigurationService
    ) {}
    public async activate(_resource: Resource): Promise<void> {
        // Check to see if raw notebooks are supported
        // If not, don't bother with prewarming
        // Also respect the disable autostart setting to not do any prewarming for the user
        if (
            !(await this.rawNotebookSupported.supported()) ||
            this.configService.getSettings().datascience.disableJupyterAutoStart
        ) {
            return;
        }

        this.disposables.push(this.notebookEditorProvider.onDidOpenNotebookEditor(this.preWarmKernelDaemonPool, this));
        this.disposables.push(
            this.interactiveProvider.onDidChangeActiveInteractiveWindow(this.preWarmKernelDaemonPool, this)
        );
        if (this.notebookEditorProvider.editors.length > 0 || this.interactiveProvider.windows.length > 0) {
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
