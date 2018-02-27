// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { IProcessService } from '../../common/process/types';
import { IServiceContainer } from '../../ioc/types';
import { IVirtualEnvironmentManager } from './types';

@injectable()
export class VirtualEnvironmentManager implements IVirtualEnvironmentManager {
    private processService: IProcessService;
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        this.processService = serviceContainer.get<IProcessService>(IProcessService);
    }
    public async getEnvironmentName(pythonPath: string): Promise<string> {
        // https://stackoverflow.com/questions/1871549/determine-if-python-is-running-inside-virtualenv
        const output = await this.processService.exec(pythonPath, ['-c', 'import sys;print(hasattr(sys, "real_prefix"))']);
        if (output.stdout.length > 0) {
            const result = output.stdout.trim();
            if (result === 'True') {
                return 'virtualenv';
            }
        }
        return '';
    }
}
