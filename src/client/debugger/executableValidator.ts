// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IFileSystem } from '../common/platform/types';
import { IProcessServiceFactory } from '../common/process/types';
import { IServiceContainer } from '../ioc/types';
import { IExcutableValidator } from './types';

@injectable()
export class ExcutableValidator implements IExcutableValidator {
    constructor(@inject(IServiceContainer) private readonly serviceContainer: IServiceContainer) { }
    /**
     * Checks the validity of the executable.
     * Do not use `<python> --version` as the output in 2.7 comes in stderr.
     * Check if either one of the following is true:
     * 1. Use `<python> -c print('1')` as the executable could python.
     * 2. Check if the executable file exists (in case of `spark-submit`)
     * @param {string} exePath
     * @returns {Promise<boolean>}
     * @memberof DebuggerExcutableValidator
     */
    public async validateExecutable(exePath: string): Promise<boolean> {
        const processFactory = this.serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory);
        const fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
        const processService = await processFactory.create();
        const [valid, execuableExists] = await Promise.all([
            processService.exec(exePath, ['-c', 'print("1")'])
                .then(output => output.stdout.trim() === '1')
                .catch(() => false),
            fs.fileExists(exePath)
        ]);

        return valid || execuableExists;
    }

}
