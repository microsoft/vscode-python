// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { IPlatformService } from '../platform/types';
import { OSType } from '../utils/platform';
import { IDotNetCompatibilityService, IOSDotNetCompatibilityService } from './types';

@injectable()
export class DotNetCompatibilityService implements IDotNetCompatibilityService {
    private readonly mappedServices = new Map<OSType, IDotNetCompatibilityService>();
    constructor(@inject(IOSDotNetCompatibilityService) @named(OSType.Unknown) unknownOsService: IOSDotNetCompatibilityService,
        @inject(IOSDotNetCompatibilityService) @named(OSType.OSX) macService: IOSDotNetCompatibilityService,
        @inject(IOSDotNetCompatibilityService) @named(OSType.Windows) winService: IOSDotNetCompatibilityService,
        @inject(IOSDotNetCompatibilityService) @named(OSType.Linux) linuxService: IOSDotNetCompatibilityService,
        @inject(IPlatformService) private readonly platformService: IPlatformService) {
        this.mappedServices.set(OSType.Unknown, unknownOsService);
        this.mappedServices.set(OSType.OSX, macService);
        this.mappedServices.set(OSType.Windows, winService);
        this.mappedServices.set(OSType.Linux, linuxService);
    }
    public isSupported() {
        return this.mappedServices.get(this.platformService.osType)!.isSupported();
    }
}
