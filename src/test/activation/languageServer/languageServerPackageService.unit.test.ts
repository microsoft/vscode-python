// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any no-invalid-this max-func-body-length

import { expect } from 'chai';
import { SemVer } from 'semver';
import * as typeMoq from 'typemoq';
import {
    azureCDNBlobStorageAccount,
    LanguageServerDownloadChannel
} from '../../../client/activation/common/packageRepository';
import { DotNetLanguageServerPackageService } from '../../../client/activation/languageServer/languageServerPackageService';
import { PlatformName } from '../../../client/activation/types';
import { IApplicationEnvironment } from '../../../client/common/application/types';
import { NugetService } from '../../../client/common/nuget/nugetService';
import { INugetRepository, INugetService, NugetPackage } from '../../../client/common/nuget/types';
import { IPlatformService } from '../../../client/common/platform/types';
import { IConfigurationService } from '../../../client/common/types';
import { OSType } from '../../../client/common/utils/platform';
import { IServiceContainer } from '../../../client/ioc/types';

const downloadBaseFileName = 'Python-Language-Server';

suite('Language Server - Package Service', () => {
    let serviceContainer: typeMoq.IMock<IServiceContainer>;
    let platform: typeMoq.IMock<IPlatformService>;
    let lsPackageService: DotNetLanguageServerPackageService;
    let appVersion: typeMoq.IMock<IApplicationEnvironment>;
    setup(() => {
        serviceContainer = typeMoq.Mock.ofType<IServiceContainer>();
        platform = typeMoq.Mock.ofType<IPlatformService>();
        appVersion = typeMoq.Mock.ofType<IApplicationEnvironment>();
        lsPackageService = new DotNetLanguageServerPackageService(
            serviceContainer.object,
            appVersion.object,
            platform.object
        );
        lsPackageService.getLanguageServerDownloadChannel = () => 'stable';
    });
    function setMinVersionOfLs(version: string) {
        const packageJson = { languageServerVersion: version };
        appVersion.setup((e) => e.packageJson).returns(() => packageJson);
    }
    [true, false].forEach((is64Bit) => {
        const bitness = is64Bit ? '64bit' : '32bit';
        test(`Get Package name for Windows (${bitness})`, async () => {
            platform.setup((p) => p.osType).returns(() => OSType.Windows);
            platform.setup((p) => p.is64bit).returns(() => is64Bit);
            const expectedName = is64Bit
                ? `${downloadBaseFileName}-${PlatformName.Windows64Bit}`
                : `${downloadBaseFileName}-${PlatformName.Windows32Bit}`;

            const name = lsPackageService.getNugetPackageName();

            platform.verifyAll();
            expect(name).to.be.equal(expectedName);
        });
        test(`Get Package name for Mac (${bitness})`, async () => {
            platform.setup((p) => p.osType).returns(() => OSType.OSX);
            const expectedName = `${downloadBaseFileName}-${PlatformName.Mac64Bit}`;

            const name = lsPackageService.getNugetPackageName();

            platform.verifyAll();
            expect(name).to.be.equal(expectedName);
        });
        test(`Get Package name for Linux (${bitness})`, async () => {
            platform.setup((p) => p.osType).returns(() => OSType.Linux);
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
        setMinVersionOfLs('0.0.1');
        const packages: NugetPackage[] = [
            { package: '', uri: '', version: new SemVer('1.1.1') },
            { package: '', uri: '', version: new SemVer('3.4.1') },
            { package: '', uri: '', version: new SemVer('3.1.1') },
            { package: '', uri: '', version: new SemVer('2.1.1') }
        ];
        const expectedPackage = packages[1];
        const repo = typeMoq.Mock.ofType<INugetRepository>();
        const nuget = typeMoq.Mock.ofType<INugetService>();
        serviceContainer
            .setup((c) => c.get(typeMoq.It.isValue(INugetRepository), typeMoq.It.isAny()))
            .returns(() => repo.object);
        serviceContainer.setup((c) => c.get(typeMoq.It.isValue(INugetService))).returns(() => nuget.object);

        repo.setup((n) => n.getPackages(typeMoq.It.isValue(packageName), typeMoq.It.isAny()))
            .returns(() => Promise.resolve(packages))
            .verifiable(typeMoq.Times.once());
        nuget
            .setup((n) => n.isReleaseVersion(typeMoq.It.isAny()))
            .returns(() => true)
            .verifiable(typeMoq.Times.atLeastOnce());

        const info = await lsPackageService.getLatestNugetPackageVersion(undefined);

        repo.verifyAll();
        nuget.verifyAll();
        expect(info).to.deep.equal(expectedPackage);
    });
    test('Get latest nuget package version (excluding non-release)', async () => {
        setMinVersionOfLs('0.0.1');
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
        serviceContainer
            .setup((c) => c.get(typeMoq.It.isValue(INugetRepository), typeMoq.It.isAny()))
            .returns(() => repo.object);
        serviceContainer.setup((c) => c.get(typeMoq.It.isValue(INugetService))).returns(() => nuget);

        repo.setup((n) => n.getPackages(typeMoq.It.isValue(packageName), typeMoq.It.isAny()))
            .returns(() => Promise.resolve(packages))
            .verifiable(typeMoq.Times.once());

        const info = await lsPackageService.getLatestNugetPackageVersion(undefined);

        repo.verifyAll();
        expect(info).to.deep.equal(expectedPackage);
    });
    test('Ensure minimum version of package is used', async () => {
        const minimumVersion = '0.1.50';
        setMinVersionOfLs(minimumVersion);
        const packageName = 'packageName';
        lsPackageService.getNugetPackageName = () => packageName;
        lsPackageService.maxMajorVersion = 0;
        const packages: NugetPackage[] = [
            { package: '', uri: '', version: new SemVer('0.1.48') },
            { package: '', uri: '', version: new SemVer('0.1.49') }
        ];
        const repo = typeMoq.Mock.ofType<INugetRepository>();
        const nuget = new NugetService();
        serviceContainer
            .setup((c) => c.get(typeMoq.It.isValue(INugetRepository), typeMoq.It.isAny()))
            .returns(() => repo.object);
        serviceContainer.setup((c) => c.get(typeMoq.It.isValue(INugetService))).returns(() => nuget);

        repo.setup((n) => n.getPackages(typeMoq.It.isValue(packageName), typeMoq.It.isAny()))
            .returns(() => Promise.resolve(packages))
            .verifiable(typeMoq.Times.once());

        const info = await lsPackageService.getLatestNugetPackageVersion(undefined, minimumVersion);

        repo.verifyAll();
        const expectedPackage: NugetPackage = {
            version: new SemVer(minimumVersion),
            package: LanguageServerDownloadChannel.stable,
            uri: `${azureCDNBlobStorageAccount}/${LanguageServerDownloadChannel.stable}/${packageName}.${minimumVersion}.nupkg`
        };
        expect(info).to.deep.equal(expectedPackage);
    });
});
suite('Language Server Package Service - getLanguageServerDownloadChannel()', () => {
    let serviceContainer: typeMoq.IMock<IServiceContainer>;
    let platform: typeMoq.IMock<IPlatformService>;
    let lsPackageService: DotNetLanguageServerPackageService;
    let appVersion: typeMoq.IMock<IApplicationEnvironment>;
    let configService: typeMoq.IMock<IConfigurationService>;
    setup(() => {
        serviceContainer = typeMoq.Mock.ofType<IServiceContainer>();
        platform = typeMoq.Mock.ofType<IPlatformService>();
        appVersion = typeMoq.Mock.ofType<IApplicationEnvironment>();
        configService = typeMoq.Mock.ofType<IConfigurationService>();
        serviceContainer.setup((s) => s.get(IConfigurationService)).returns(() => configService.object);
        lsPackageService = new DotNetLanguageServerPackageService(
            serviceContainer.object,
            appVersion.object,
            platform.object
        );
        lsPackageService.isAlphaVersionOfExtension = () => true;
    });
    test("If 'python.analysis.downloadChannel' setting is specified, return the value of the setting", async () => {
        const settings = {
            analysis: {
                downloadChannel: 'someValue'
            }
        };
        configService.setup((c) => c.getSettings()).returns(() => settings as any);

        lsPackageService.isAlphaVersionOfExtension = () => {
            throw new Error('Should not be here');
        };
        const downloadChannel = lsPackageService.getLanguageServerDownloadChannel();

        expect(downloadChannel).to.be.equal('someValue');
    });

    test("If 'python.analysis.downloadChannel' setting is not specified and insiders channel is 'weekly', return 'beta'", async () => {
        const settings = {
            analysis: {},
            insidersChannel: 'weekly'
        };
        configService.setup((c) => c.getSettings()).returns(() => settings as any);

        lsPackageService.isAlphaVersionOfExtension = () => {
            throw new Error('Should not be here');
        };
        const downloadChannel = lsPackageService.getLanguageServerDownloadChannel();

        expect(downloadChannel).to.be.equal('beta');
    });

    test("If 'python.analysis.downloadChannel' setting is not specified and insiders channel is 'daily', return 'beta'", async () => {
        const settings = {
            analysis: {},
            insidersChannel: 'daily'
        };
        configService.setup((c) => c.getSettings()).returns(() => settings as any);

        lsPackageService.isAlphaVersionOfExtension = () => {
            throw new Error('Should not be here');
        };
        const downloadChannel = lsPackageService.getLanguageServerDownloadChannel();

        expect(downloadChannel).to.be.equal('beta');
    });

    test("If 'python.analysis.downloadChannel' setting is not specified, user is not using insiders, and extension has Alpha version, return 'beta'", async () => {
        const settings = {
            analysis: {},
            insidersChannel: 'off'
        };
        configService.setup((c) => c.getSettings()).returns(() => settings as any);

        lsPackageService.isAlphaVersionOfExtension = () => true;
        const downloadChannel = lsPackageService.getLanguageServerDownloadChannel();

        expect(downloadChannel).to.be.equal('beta');
    });

    test("If 'python.analysis.downloadChannel' setting is not specified, user is not using insiders, and extension does not have Alpha version, return 'stable'", async () => {
        const settings = {
            analysis: {},
            insidersChannel: 'off'
        };
        configService.setup((c) => c.getSettings()).returns(() => settings as any);

        lsPackageService.isAlphaVersionOfExtension = () => false;
        const downloadChannel = lsPackageService.getLanguageServerDownloadChannel();

        expect(downloadChannel).to.be.equal('stable');
    });
});
