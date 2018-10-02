// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any no-invalid-this max-func-body-length

import { expect } from 'chai';
import { SemVer } from 'semver';
import * as typeMoq from 'typemoq';
import { LanguageServerPackageService } from '../../../client/activation/languageServer/languageServerPackageService';
import { PlatformName } from '../../../client/activation/platformData';
import { NugetService } from '../../../client/common/nuget/nugetService';
import { INugetRepository, INugetService, NugetPackage } from '../../../client/common/nuget/types';
import { IPlatformService } from '../../../client/common/platform/types';
import { IServiceContainer } from '../../../client/ioc/types';
import { Architecture, OSType } from '../../../utils/platform';

const downloadBaseFileName = 'Python-Language-Server';

suite('Language Server Package Service', () => {
    let serviceContainer: typeMoq.IMock<IServiceContainer>;
    let platform: typeMoq.IMock<IPlatformService>;
    let lsPackageService: LanguageServerPackageService;
    setup(() => {
        serviceContainer = typeMoq.Mock.ofType<IServiceContainer>();
        platform = typeMoq.Mock.ofType<IPlatformService>();
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(IPlatformService))).returns(() => platform.object);

        lsPackageService = new LanguageServerPackageService(serviceContainer.object);
        lsPackageService.getLanguageServerDownloadChannel = () => 'stable';
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
    });
    test('Get latest nuget package version', async () => {
        const packageName = 'packageName';
        lsPackageService.getNugetPackageName = () => packageName;
        lsPackageService.maxMajorVersion = 3;
        const packages: NugetPackage[] = [
            { package: '', uri: '', version: new SemVer('1.1.1') },
            { package: '', uri: '', version: new SemVer('3.4.1') },
            { package: '', uri: '', version: new SemVer('3.1.1') },
            { package: '', uri: '', version: new SemVer('2.1.1') }
        ];
        const expectedPackage = packages[1];
        const repo = typeMoq.Mock.ofType<INugetRepository>();
        const nuget = typeMoq.Mock.ofType<INugetService>();
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(INugetRepository), typeMoq.It.isAny())).returns(() => repo.object);
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(INugetService))).returns(() => nuget.object);

        repo
            .setup(n => n.getPackages(typeMoq.It.isValue(packageName)))
            .returns(() => Promise.resolve(packages))
            .verifiable(typeMoq.Times.once());
        nuget
            .setup(n => n.isReleaseVersion(typeMoq.It.isAny()))
            .returns(() => true)
            .verifiable(typeMoq.Times.atLeastOnce());

        const info = await lsPackageService.getLatestNugetPackageVersion();

        repo.verifyAll();
        nuget.verifyAll();
        expect(info).to.deep.equal(expectedPackage);
    });
    test('Get latest nuget package version (excluding non-release)', async () => {
        const packageName = 'packageName';
        lsPackageService.getNugetPackageName = () => packageName;
        lsPackageService.maxMajorVersion = 1;
        const packages: NugetPackage[] = [
            { package: '', uri: '', version: new SemVer('1.1.1') },
            { package: '', uri: '', version: new SemVer('1.3.1-alpha') },
            { package: '', uri: '', version: new SemVer('1.4.1-preview') },
            { package: '', uri: '', version: new SemVer('1.2.1-internal') }
        ];
        const expectedPackage = packages[0];
        const repo = typeMoq.Mock.ofType<INugetRepository>();
        const nuget = new NugetService();
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(INugetRepository), typeMoq.It.isAny())).returns(() => repo.object);
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(INugetService))).returns(() => nuget);

        repo
            .setup(n => n.getPackages(typeMoq.It.isValue(packageName)))
            .returns(() => Promise.resolve(packages))
            .verifiable(typeMoq.Times.once());

        const info = await lsPackageService.getLatestNugetPackageVersion();

        repo.verifyAll();
        expect(info).to.deep.equal(expectedPackage);
    });
});
