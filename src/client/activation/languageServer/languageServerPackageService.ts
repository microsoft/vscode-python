// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IApplicationEnvironment } from '../../common/application/types';
import { IPlatformService } from '../../common/platform/types';
import { OSType } from '../../common/utils/platform';
import { IServiceContainer } from '../../ioc/types';
import { LanguageServerPackageService } from '../common/languageServerPackageService';
import { PlatformName } from '../types';

const downloadBaseFileName = 'Python-Language-Server';
export const PackageNames = {
    [PlatformName.Windows32Bit]: `${downloadBaseFileName}-${PlatformName.Windows32Bit}`,
    [PlatformName.Windows64Bit]: `${downloadBaseFileName}-${PlatformName.Windows64Bit}`,
    [PlatformName.Linux64Bit]: `${downloadBaseFileName}-${PlatformName.Linux64Bit}`,
    [PlatformName.Mac64Bit]: `${downloadBaseFileName}-${PlatformName.Mac64Bit}`
};

@injectable()
export class DotNetLanguageServerPackageService extends LanguageServerPackageService {
    constructor(
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(IApplicationEnvironment) appEnv: IApplicationEnvironment,
        @inject(IPlatformService) platform: IPlatformService
    ) {
        super(serviceContainer, appEnv, platform);
    }

    public getNugetPackageName(): string {
        switch (this.platform.osType) {
            case OSType.Windows:
                return PackageNames[this.platform.is64bit ? PlatformName.Windows64Bit : PlatformName.Windows32Bit];
            case OSType.OSX:
                return PackageNames[PlatformName.Mac64Bit];
            default:
                return PackageNames[PlatformName.Linux64Bit];
        }
    }
}
