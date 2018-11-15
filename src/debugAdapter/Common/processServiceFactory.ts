// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ProcessService } from '../../client/common/process/proc';
import { IBufferDecoder, IProcessService, IProcessServiceFactory } from '../../client/common/process/types';
import { IServiceContainer } from '../../client/ioc/types';

@injectable()
export class DebuggerProcessServiceFactory implements IProcessServiceFactory {
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) { }
    public create(): Promise<IProcessService> {
        const processService = new ProcessService(this.serviceContainer.get<IBufferDecoder>(IBufferDecoder), process.env);
        return Promise.resolve(processService);
    }
}
