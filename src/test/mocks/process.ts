// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import { ICurrentProcess } from '../../client/common/types';
import { EnvironmentVariables } from '../../client/common/variables/types';

@injectable()
export class MockProcess implements ICurrentProcess {
    constructor(public env: EnvironmentVariables = { ...process.env }) { }
}
