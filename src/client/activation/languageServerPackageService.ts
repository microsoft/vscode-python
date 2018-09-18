// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Architecture, OSType } from '../../utils/platform';
import { IPlatformService } from '../common/platform/types';
import { INugetRepo, NugetPackage } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { PlatformName } from './platformData';
import { ILanguageServerPackageService } from './types';

const downloadBaseFileName = 'Python-Language-Server';
const nugetPackageBaseAddress = 'https://dotnetmyget.blob.core.windows.net/artifacts/dotnet-core-svc/nuget/v3/flatcontainer';
const maxMajorVersion = 1;

export const PackageNames = {
    [PlatformName.Windows32Bit]: `${downloadBaseFileName}-${PlatformName.Windows32Bit}`,
    [PlatformName.Windows64Bit]: `${downloadBaseFileName}-${PlatformName.Windows64Bit}`,
    [PlatformName.Linux64Bit]: `${downloadBaseFileName}-${PlatformName.Linux64Bit}`,
    [PlatformName.Mac64Bit]: `${downloadBaseFileName}-${PlatformName.Mac64Bit}`
};

@injectable()
export class LanguageServerPackageService implements ILanguageServerPackageService {
    constructor(@inject(IServiceContainer) private readonly serviceContainer: IServiceContainer) { }
    public getNugetPackageName(): string {
        const plaform = this.serviceContainer.get<IPlatformService>(IPlatformService);
        switch (plaform.info.type) {
            case OSType.Windows: {
                const is64Bit = plaform.info.architecture === Architecture.x64;
                return PackageNames[is64Bit ? PlatformName.Windows64Bit : PlatformName.Windows32Bit];
            }
            case OSType.OSX: {
                return PackageNames[PlatformName.Mac64Bit];
            }
            default: {
                return PackageNames[PlatformName.Linux64Bit];
            }
        }
    }

    public getLatestNugetPackageVersion(): Promise<NugetPackage> {
        const nuget = this.serviceContainer.get<INugetRepo>(INugetRepo);
        const packageName = this.getNugetPackageName();
        return nuget.getLatestVersion(nugetPackageBaseAddress, packageName, maxMajorVersion);
    }
}
