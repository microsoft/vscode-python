// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { IPlatformService } from '../platform/types';
import { OSType } from '../utils/platform';
import { IDotNetCompatibilityService, IOSDotNetCompatibilityService } from './types';

/**
 * .NET Core 2.1 OS Requirements
 * https://github.com/dotnet/core/blob/master/release-notes/2.1/2.1-supported-os.md
 * We are using the versions provided in the above .NET 2.1 Core requirements page as minimum required versions.
 * Why, cuz getting distros, mapping them to the ones listd on .NET 2.1 Core requirements are entirely accurate.
 * Due to the inaccuracy, its easier and safer to just assume futur versions of an OS are also supported.
 * We will need to regularly update the requirements over time, when using .NET Core 2.2 or 3, etc.
 */
@injectable()
export class DotNetCompatibilityService implements IDotNetCompatibilityService {
    private readonly mappedServices = new Map<OSType, IDotNetCompatibilityService>();
    constructor(
        @inject(IOSDotNetCompatibilityService) @named(OSType.Unknown) unknownOsService: IOSDotNetCompatibilityService,
        @inject(IOSDotNetCompatibilityService) @named(OSType.OSX) macService: IOSDotNetCompatibilityService,
        @inject(IOSDotNetCompatibilityService) @named(OSType.Windows) winService: IOSDotNetCompatibilityService,
        @inject(IOSDotNetCompatibilityService) @named(OSType.Linux) linuxService: IOSDotNetCompatibilityService,
        @inject(IPlatformService) private readonly platformService: IPlatformService
    ) {
        this.mappedServices.set(OSType.Unknown, unknownOsService);
        this.mappedServices.set(OSType.OSX, macService);
        this.mappedServices.set(OSType.Windows, winService);
        this.mappedServices.set(OSType.Linux, linuxService);
    }
    public isSupported() {
        return this.mappedServices.get(this.platformService.osType)!.isSupported();
    }
}
