// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any no-invalid-this max-func-body-length

import { expect } from 'chai';
import { SemVer } from 'semver';
import * as typeMoq from 'typemoq';
import { AzureBlobLanguageServerPackageService, LanguageServerPackageService } from '../../client/activation/languageServerPackageService';
import { PlatformName } from '../../client/activation/platformData';
import { ILanguageServerPackageService } from '../../client/activation/types';
import { IPlatformService } from '../../client/common/platform/types';
import { IAzureBlobStore, INugetRepo, NugetPackage } from '../../client/common/types';
import { IServiceContainer } from '../../client/ioc/types';
import { Architecture, OSType } from '../../utils/platform';

const downloadBaseFileName = 'Python-Language-Server';

suite('Language Server Package Service', () => {
    const nugetTestName = 'Nuget Store';
    const azureBlobTestName = 'Azure Store';
    [
        { name: nugetTestName, class: LanguageServerPackageService },
        { name: azureBlobTestName, class: AzureBlobLanguageServerPackageService }
    ].forEach(item => {
        suite(item.name, () => {
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

                lsPackageService = new item.class(serviceContainer.object);
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
                test('Get latest nuget package version (nuget store)', async function () {
                    if (item.name !== nugetTestName) {
                        return this.skip();
                    }
                    const nugetPackageBaseAddress = 'https://dotnetmyget.blob.core.windows.net/artifacts/dotnet-core-svc/nuget/v3/flatcontainer';
                    const packageName = 'packageName';
                    lsPackageService.getNugetPackageName = () => packageName;
                    const pkgInfo = { package: '', uri: '', version: undefined } as any as NugetPackage;
                    nugetRepo
                        .setup(n => n.getLatestVersion(typeMoq.It.isValue(nugetPackageBaseAddress),
                            typeMoq.It.isValue(packageName), typeMoq.It.isAny()))
                        .returns(() => Promise.resolve(pkgInfo))
                        .verifiable(typeMoq.Times.atLeastOnce());

                    const info = await lsPackageService.getLatestNugetPackageVersion();

                    nugetRepo.verifyAll();
                    expect(info).to.deep.equal(pkgInfo);
                });
                test('Get latest nuget package version (azure store)', async function () {
                    if (item.name !== azureBlobTestName) {
                        return this.skip();
                    }
                    const nugetPackages: NugetPackage[] = [
                        { package: 'a', uri: 'uri1', version: new SemVer('1.1.1') },
                        { package: 'b', uri: 'uri2', version: new SemVer('3.1.1') },
                        { package: 'c', uri: 'uri3', version: new SemVer('2.1.1') }
                    ];
                    lsPackageService.getNugetPackageName = () => 'packageName';
                    (lsPackageService as AzureBlobLanguageServerPackageService).getLatestNugetPackages = _ => Promise.resolve(nugetPackages);
                    const expectedPkg = nugetPackages[1];

                    const info = await lsPackageService.getLatestNugetPackageVersion();

                    expect(info).to.deep.equal(expectedPkg);
                });
                test('Get latest nuget packages (azure store)', async function () {
                    if (item.name !== azureBlobTestName) {
                        return this.skip();
                    }
                    const blobStore = typeMoq.Mock.ofType<IAzureBlobStore>();
                    serviceContainer.setup(s => s.get(typeMoq.It.isValue(IAzureBlobStore))).returns(() => blobStore.object);
                    const version = new SemVer('0.0.0');
                    const nugetPackages: NugetPackage[] = [
                        { package: 'a', uri: 'uri1', version },
                        { package: 'b', uri: 'uri2', version },
                        { package: 'c', uri: 'uri3', version }
                    ];
                    const blobStores = nugetPackages.map(pkg => {
                        return { name: pkg.package, uri: pkg.uri };
                    });
                    nugetRepo
                        .setup(n => n.isReleaseVersion(typeMoq.It.isAny()))
                        .returns(() => true)
                        .verifiable(typeMoq.Times.exactly(nugetPackages.length));
                    nugetRepo
                        .setup(n => n.getVersion(typeMoq.It.isAny()))
                        .returns(() => version)
                        .verifiable(typeMoq.Times.exactly(nugetPackages.length));
                    const packageName = 'abcd';
                    const azureBlobStorageAccount = 'https://pvsc.blob.core.windows.net';
                    const azureBlobStorageContainer = 'python-language-server';
                    blobStore
                        .setup(b => b.searhBlobs(typeMoq.It.isValue(azureBlobStorageAccount),
                            typeMoq.It.isValue(azureBlobStorageContainer),
                            typeMoq.It.isValue(packageName)))
                        .returns(() => Promise.resolve(blobStores))
                        .verifiable(typeMoq.Times.once());

                    const packages = await (lsPackageService as AzureBlobLanguageServerPackageService).getLatestNugetPackages(packageName);

                    expect(packages).to.deep.equal(nugetPackages);
                });
            });
        });
    });
});
