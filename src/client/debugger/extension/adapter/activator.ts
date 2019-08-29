// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IExtensionSingleActivationService } from '../../../activation/types';
import { IDebugService } from '../../../common/application/types';
import { DebugAdapterDescriptorFactory as DebugAdapterExperiment } from '../../../common/experimentGroups';
import { IDisposableRegistry, IExperimentsManager } from '../../../common/types';
import { DebuggerTypeName } from '../../constants';
import { IDebugAdapterDescriptorFactory } from '../types';

@injectable()
export class DebugAdapterActivator implements IExtensionSingleActivationService {
    constructor(
        @inject(IDebugService) private readonly debugService: IDebugService,
        @inject(IDebugAdapterDescriptorFactory) private factory: IDebugAdapterDescriptorFactory,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
        @inject(IExperimentsManager) private readonly experimentsManager: IExperimentsManager
    ) {}
    public async activate(): Promise<void> {
        if (this.experimentsManager.inExperiment(DebugAdapterExperiment.experiment)) {
            this.disposables.push(this.debugService.registerDebugAdapterDescriptorFactory(DebuggerTypeName, this.factory));
        }
    }
}
