// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IExtensionSingleActivationService } from '../../../activation/types';
import { IDebugService } from '../../../common/application/types';
import { DebugAdapterDescriptorFactory } from '../../../common/experimentGroups';
import { IDisposableRegistry, IExperimentsManager } from '../../../common/types';
import { DebuggerTypeName } from '../../constants';
import { IAttachProcessProviderFactory } from '../attachQuickPick/types';
import { IDebugAdapterDescriptorFactory, IDebugSessionLoggingFactory } from '../types';

@injectable()
export class DebugAdapterActivator implements IExtensionSingleActivationService {
    constructor(
        @inject(IDebugService) private readonly debugService: IDebugService,
        @inject(IDebugAdapterDescriptorFactory) private descriptorFactory: IDebugAdapterDescriptorFactory,
        @inject(IDebugSessionLoggingFactory) private debugSessionLoggingFactory: IDebugSessionLoggingFactory,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
        @inject(IExperimentsManager) private readonly experimentsManager: IExperimentsManager,
        @inject(IAttachProcessProviderFactory) private readonly attachProcessProviderFactory: IAttachProcessProviderFactory
    ) {}
    public async activate(): Promise<void> {
        if (this.experimentsManager.inExperiment(DebugAdapterDescriptorFactory.experiment)) {
            this.attachProcessProviderFactory.registerCommands();

            this.disposables.push(this.debugService.registerDebugAdapterTrackerFactory(DebuggerTypeName, this.debugSessionLoggingFactory));
            this.disposables.push(this.debugService.registerDebugAdapterDescriptorFactory(DebuggerTypeName, this.descriptorFactory));
        } else {
            this.experimentsManager.sendTelemetryIfInExperiment(DebugAdapterDescriptorFactory.control);
        }
    }
}
