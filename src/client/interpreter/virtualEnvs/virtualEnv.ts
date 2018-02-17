// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { IFileSystem } from '../../common/platform/types';
import { IServiceContainer } from '../../ioc/types';
import { InterpreterType } from '../contracts';
import { IVirtualEnvironmentIdentifier } from './types';

@injectable()
export class VirtualEnv implements IVirtualEnvironmentIdentifier {
    public readonly name: string = 'virtualenv';
    public readonly type = InterpreterType.VirtualEnv;
    private fs: IFileSystem;

    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        this.fs = serviceContainer.get<IFileSystem>(IFileSystem);
    }
    public async detect(pythonPath: string): Promise<boolean> {
        const dir = path.dirname(pythonPath);
        const libExists = await this.fs.directoryExistsAsync(path.join(dir, '..', 'lib'));
        const binExists = await this.fs.directoryExistsAsync(path.join(dir, '..', 'bin'));
        const includeExists = await this.fs.directoryExistsAsync(path.join(dir, '..', 'include'));
        return libExists && binExists && includeExists;
    }
}
