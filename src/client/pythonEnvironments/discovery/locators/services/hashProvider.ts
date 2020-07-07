// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject } from 'inversify';
import { IFileSystem } from '../../../../common/platform/types';

export class InterpreterHashProvider {
    constructor(@inject(IFileSystem) private readonly fs: IFileSystem) {}
    public async getInterpreterHash(pythonPath: string): Promise<string> {
        return this.fs.getFileHash(pythonPath);
    }
}
