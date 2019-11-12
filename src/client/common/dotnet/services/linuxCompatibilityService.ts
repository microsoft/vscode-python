// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { traceDecorators, traceError } from '../../logger';
import { IPlatformService } from '../../platform/types';
import { IOSDotNetCompatibilityService } from '../types';

@injectable()
export class LinuxDotNetCompatibilityService implements IOSDotNetCompatibilityService {
    constructor(@inject(IPlatformService) private readonly platformService: IPlatformService) {}
    @traceDecorators.verbose('Checking support of .NET')
    public async isSupported() {
        if (!this.platformService.is64bit) {
            traceError('.NET is not supported on 32 Bit Linux');
            return false;
        }
        return true;
    }
}
