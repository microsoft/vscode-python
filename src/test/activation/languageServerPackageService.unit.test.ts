// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { expect } from 'chai';
import * as typeMoq from 'typemoq';
import { LanguageServerPackageService } from '../../client/activation/languageServerPackageService';
import { PlatformName } from '../../client/activation/platformData';
import { ILanguageServerPackageService } from '../../client/activation/types';
import { IPlatformService } from '../../client/common/platform/types';
import { INugetRepo, NugetPackage } from '../../client/common/types';
import { IServiceContainer } from '../../client/ioc/types';
import { Architecture, OSType } from '../../utils/platform';

const downloadBaseFileName = 'Python-Language-Server';

suite('Language Server Package Service', () => {
    let serviceContainer: typeMoq.IMock<IServiceContainer>;
    let nugetRepo: typeMoq.IMock<INugetRepo>;
    let platform: typeMoq.IMock<IPlatformService>;
    let lsPackageService: ILanguageServerPackageService;
    setup(() => {
        serviceContainer = typeMoq.Mock.ofType<IServiceContainer>();
        nugetRepo = typeMoq.Mock.ofType<INugetRepo>();
        platform = typeMoq.Mock.ofType<IPlatformService>();
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(INugetRepo))).returns(() => nugetRepo.object);
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(IPlatformService))).returns(() => platform.object);

        lsPackageService = new LanguageServerPackageService(serviceContainer.object);
    });
    [true, false].forEach(is64Bit => {
        const bitness = is64Bit ? '64bit' : '32bit';
        const architecture = is64Bit ? Architecture.x64 : Architecture.x86;
        test(`Get Package name for Windows (${bitness})`, async () => {
            platform
                .setup(p => p.info)
                .returns(() => { return { type: OSType.Windows, architecture } as any; })
                .verifiable(typeMoq.Times.atLeastOnce());
            const expectedName = is64Bit ? `${downloadBaseFileName}-${PlatformName.Windows64Bit}` : `${downloadBaseFileName}-${PlatformName.Windows32Bit}`;

            const name = lsPackageService.getNugetPackageName();

            platform.verifyAll();
            expect(name).to.be.equal(expectedName);
        });
        test(`Get Package name for Mac (${bitness})`, async () => {
            platform
                .setup(p => p.info)
                .returns(() => { return { type: OSType.OSX, architecture } as any; })
                .verifiable(typeMoq.Times.atLeastOnce());
            const expectedName = `${downloadBaseFileName}-${PlatformName.Mac64Bit}`;

            const name = lsPackageService.getNugetPackageName();

            platform.verifyAll();
            expect(name).to.be.equal(expectedName);
        });
        test(`Get Package name for Linux (${bitness})`, async () => {
            platform
                .setup(p => p.info)
                .returns(() => { return { type: OSType.Linux, architecture } as any; })
                .verifiable(typeMoq.Times.atLeastOnce());
            const expectedName = `${downloadBaseFileName}-${PlatformName.Linux64Bit}`;

            const name = lsPackageService.getNugetPackageName();

            platform.verifyAll();
            expect(name).to.be.equal(expectedName);
        });
        test('Get latest nuget package version', async () => {
            const nugetPackageBaseAddress = 'https://dotnetmyget.blob.core.windows.net/artifacts/dotnet-core-svc/nuget/v3/flatcontainer';
            const packageName = 'packageName';
            const maxMajorVersion = 1;
            lsPackageService.getNugetPackageName = () => packageName;
            const pkgInfo = { package: '', uri: '', version: undefined } as any as NugetPackage;
            nugetRepo
                .setup(n => n.getLatestVersion(typeMoq.It.isValue(nugetPackageBaseAddress),
                    typeMoq.It.isValue(packageName), typeMoq.It.isValue(maxMajorVersion)))
                .returns(() => Promise.resolve(pkgInfo))
                .verifiable(typeMoq.Times.atLeastOnce());

            const info = await lsPackageService.getLatestNugetPackageVersion();

            nugetRepo.verifyAll();
            expect(info).to.deep.equal(pkgInfo);
        });
    });
});
