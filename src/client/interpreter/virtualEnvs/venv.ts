// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { IFileSystem } from '../../common/platform/types';
import { IServiceContainer } from '../../ioc/types';
import { InterpreterType } from '../contracts';
import { IVirtualEnvironmentIdentifier } from './types';

const pyEnvCfgFileName = 'pyvenv.cfg';

@injectable()
export class VEnv implements IVirtualEnvironmentIdentifier {
    public readonly name: string = 'venv';
    public readonly type = InterpreterType.VEnv;
    private fs: IFileSystem;

    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        this.fs = serviceContainer.get<IFileSystem>(IFileSystem);
    }
    public detect(pythonPath: string): Promise<boolean> {
        const dir = path.dirname(pythonPath);
        const pyEnvCfgPath = path.join(dir, '..', pyEnvCfgFileName);
        return this.fs.fileExistsAsync(pyEnvCfgPath);
    }
}
