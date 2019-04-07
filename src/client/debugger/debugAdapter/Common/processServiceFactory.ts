// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ProcessService } from '../../../common/process/proc';
import { IBufferDecoder, IProcessService, IProcessServiceFactory } from '../../../common/process/types';
import { IDisposableRegistry } from '../../../common/types';
import { IServiceContainer } from '../../../ioc/types';

@injectable()
export class DebuggerProcessServiceFactory implements IProcessServiceFactory {
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) { }
    public create(): Promise<IProcessService> {
        const processService = new ProcessService(this.serviceContainer.get<IBufferDecoder>(IBufferDecoder), process.env);
        this.serviceContainer.get<IDisposableRegistry>(IDisposableRegistry).push(processService);
        return Promise.resolve(processService);
    }
}
