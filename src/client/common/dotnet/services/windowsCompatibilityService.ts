// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IPlatformService } from '../../platform/types';
import { IOSDotNetCompatibilityService } from '../types';

// Min version on https://github.com/dotnet/core/blob/master/release-notes/2.1/2.1-supported-os.md is 10.12.
// Lets just assume that anything after Win 7SP1 are supported.
const minVersion = '6.1.7601';

@injectable()
export class WindowsDotNetCompatibilityService implements IOSDotNetCompatibilityService {
    constructor(@inject(IPlatformService) private readonly platformService: IPlatformService) { }
    public async isSupported() {
        const version = await this.platformService.getVersion();
        return version.compare(minVersion) >= 0;
    }
}
