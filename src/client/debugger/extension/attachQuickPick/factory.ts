// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IApplicationShell, ICommandManager } from '../../../common/application/types';
import { IPlatformService } from '../../../common/platform/types';
import { IProcessServiceFactory } from '../../../common/process/types';
import { IDisposableRegistry } from '../../../common/types';
import { PsAttachProcessProvider } from './psProvider';
import { IAttachProcessProviderFactory } from './types';

@injectable()
export class AttachProcessProviderFactory implements IAttachProcessProviderFactory {
    constructor(
        @inject(IApplicationShell) private readonly applicationShell: IApplicationShell,
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IPlatformService) private readonly platformService: IPlatformService,
        @inject(IProcessServiceFactory) private readonly processServiceFactory: IProcessServiceFactory,
        @inject(IDisposableRegistry) private readonly disposableRegistry: IDisposableRegistry
    ) { }

    public getProvider() {
        // Will add Windows provider in a separate PR
        return new PsAttachProcessProvider(
            this.applicationShell,
            this.commandManager,
            this.disposableRegistry,
            this.platformService,
            this.processServiceFactory
        );
    }
}
