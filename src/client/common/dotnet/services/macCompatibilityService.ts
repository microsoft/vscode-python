// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IPlatformService } from '../../platform/types';
import { IOSDotNetCompatibilityService } from '../types';

// Min version on https://github.com/dotnet/core/blob/master/release-notes/2.1/2.1-supported-os.md is 10.12.
// On this site https://en.wikipedia.org/wiki/MacOS_Sierra, that maps to 16.0.0.
const minVersion = '16.0.0';

@injectable()
export class MacDotNetCompatibilityService implements IOSDotNetCompatibilityService {
    constructor(@inject(IPlatformService) private readonly platformService: IPlatformService) {}
    public async isSupported() {
        const version = await this.platformService.getVersion();
        return version.compare(minVersion) >= 0;
    }
}
