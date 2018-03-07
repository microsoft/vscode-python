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
        // hasattr(sys, 'real_prefix') works for virtualenv while
        // '(hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix))' works for venv
        const code = 'import sys\nif hasattr(sys, "real_prefix"):\n  print("virtualenv")\nelif hasattr(sys, "base_prefix") and sys.base_prefix != sys.prefix:\n  print("venv")';
        const output = await this.processService.exec(pythonPath, ['-c', code]);
        if (output.stdout.length > 0) {
            return output.stdout.trim();
        }
        return '';
    }
}
