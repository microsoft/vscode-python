// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IWorkspaceService } from '../../../common/application/types';
import { STANDARD_OUTPUT_CHANNEL } from '../../../common/constants';
import { ProcessService } from '../../../common/process/proc';
import { IBufferDecoder, IProcessService, IProcessServiceFactory } from '../../../common/process/types';
import { IDisposableRegistry, IOutputChannel } from '../../../common/types';
import { IServiceContainer } from '../../../ioc/types';

@injectable()
export class DebuggerProcessServiceFactory implements IProcessServiceFactory {
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) { }
    public create(): Promise<IProcessService> {
        const output = this.serviceContainer.get<IOutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
        const workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        const processService = new ProcessService(this.serviceContainer.get<IBufferDecoder>(IBufferDecoder), output, workspaceService, process.env);
        this.serviceContainer.get<IDisposableRegistry>(IDisposableRegistry).push(processService);
        return Promise.resolve(processService);
    }
}
