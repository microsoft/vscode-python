// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any no-invalid-this max-func-body-length

import { expect } from 'chai';
import { SemVer } from 'semver';
import * as typeMoq from 'typemoq';
import { WorkspaceConfiguration } from 'vscode';
import { AzureBlobLanguageServerPackageService, LanguageServerPackageService } from '../../client/activation/languageServerPackageService';
import { IHttpClient } from '../../client/activation/types';
import { IWorkspaceService } from '../../client/common/application/types';
import { AzureBlobStore } from '../../client/common/azureBlobStore';
import { HttpClient } from '../../client/common/net/httpClient';
import { NugetRepo } from '../../client/common/nugetRepo';
import { PlatformService } from '../../client/common/platform/platformService';
import { IPlatformService } from '../../client/common/platform/types';
import { IAzureBlobStore, INugetRepo, NugetPackage } from '../../client/common/types';
import { IServiceContainer } from '../../client/ioc/types';

suite('Language Server Package Service', () => {
    let serviceContainer: typeMoq.IMock<IServiceContainer>;
    let mockNugetRepo: typeMoq.IMock<INugetRepo>;
    setup(() => {
        serviceContainer = typeMoq.Mock.ofType<IServiceContainer>();
        mockNugetRepo = typeMoq.Mock.ofType<INugetRepo>();
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(INugetRepo))).returns(() => mockNugetRepo.object);
    });
    test('Ensure new Major versions of Language Server is accounted for (nuget)', async function () {
        return this.skip();
        const platform = typeMoq.Mock.ofType<IPlatformService>();
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(IPlatformService))).returns(() => platform.object);
        const lsPackageService = new LanguageServerPackageService(serviceContainer.object);
        let maxMajorVersion = -1;
        let nugetPackageBaseAddress = '';
        let packageName = '';
        lsPackageService.getNugetPackageName = () => '';
        mockNugetRepo
            .setup(n => n.getLatestVersion(typeMoq.It.isAny(),
                typeMoq.It.isAny(), typeMoq.It.isAny()))
            .callback((addr, name, majorVersion) => {
                nugetPackageBaseAddress = addr;
                maxMajorVersion = majorVersion;
                packageName = name;
            })
            .returns(() => Promise.resolve(undefined as any))
            .verifiable(typeMoq.Times.atLeastOnce());

        await lsPackageService.getLatestNugetPackageVersion();

        mockNugetRepo.verifyAll();
        expect(maxMajorVersion).to.be.greaterThan(0);
        expect(nugetPackageBaseAddress.length).to.be.greaterThan(-1);
        expect(packageName.length).to.be.greaterThan(0);

        // Now get latest version from actual Nuget repo.
        // Ensure the latest version on nuget repo has same major version numbner as in source.
        serviceContainer.reset();
        const workSpaceService = typeMoq.Mock.ofType<IWorkspaceService>();
        const config = typeMoq.Mock.ofType<WorkspaceConfiguration>();
        config
            .setup(c => c.get(typeMoq.It.isValue('proxy'), typeMoq.It.isValue('')))
            .returns(() => '')
            .verifiable(typeMoq.Times.once());
        workSpaceService
            .setup(w => w.getConfiguration(typeMoq.It.isValue('http')))
            .returns(() => config.object)
            .verifiable(typeMoq.Times.once());
        serviceContainer
            .setup(a => a.get(typeMoq.It.isValue(IWorkspaceService)))
            .returns(() => workSpaceService.object);

        const httpClient = new HttpClient(serviceContainer.object);

        serviceContainer
            .setup(s => s.get(typeMoq.It.isValue(IHttpClient)))
            .returns(() => httpClient)
            .verifiable(typeMoq.Times.once());

        const nugetRepo = new NugetRepo(serviceContainer.object);
        const latestVersion = await nugetRepo.getLatestVersion(nugetPackageBaseAddress, packageName);

        expect(latestVersion.version.major).to.be.equal(maxMajorVersion, 'New Major version of Language server has been released, we need to update it at our end.');
    });
    test('Ensure new Major versions of Language Server is accounted for (azure blob)', async () => {
        let lsPackageService = new AzureBlobLanguageServerPackageService(serviceContainer.object);
        let maxMajorVersion: number | undefined = -1;
        lsPackageService.getNugetPackageName = () => '';
        lsPackageService.getLatestNugetPackages = (_, majorVersion) => {
            maxMajorVersion = majorVersion;
            return Promise.resolve([{ version: new SemVer('0.0.0') } as any as NugetPackage]);
        };
        await lsPackageService.getLatestNugetPackageVersion();

        expect(maxMajorVersion).to.be.greaterThan(-1);

        // Now get latest version from actual Azure Blob Store.
        // Ensure the latest version on nuget repo has same major version numbner as in source.
        serviceContainer.reset();
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(IPlatformService))).returns(() => new PlatformService());
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(IAzureBlobStore))).returns(() => new AzureBlobStore());
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(INugetRepo))).returns(() => new NugetRepo(serviceContainer.object));

        lsPackageService = new AzureBlobLanguageServerPackageService(serviceContainer.object);
        const latestVersion = await lsPackageService.getLatestNugetPackageVersion();

        expect(latestVersion.version.major).to.be.equal(maxMajorVersion, 'New Major version of Language server has been released, we need to update it at our end.');
    });
});
