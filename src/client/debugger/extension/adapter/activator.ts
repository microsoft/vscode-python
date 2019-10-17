// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IExtensionSingleActivationService } from '../../../activation/types';
import { IDebugService } from '../../../common/application/types';
import { IDisposableRegistry } from '../../../common/types';
import { DebuggerTypeName } from '../../constants';
import { IDebugAdapterDescriptorFactory } from '../types';

@injectable()
export class DebugAdapterActivator implements IExtensionSingleActivationService {
    constructor(
        @inject(IDebugService) private readonly debugService: IDebugService,
        @inject(IDebugAdapterDescriptorFactory) private factory: IDebugAdapterDescriptorFactory,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry
    ) { }
    public async activate(): Promise<void> {
        this.disposables.push(this.debugService.registerDebugAdapterDescriptorFactory(DebuggerTypeName, this.factory));
    }
}
