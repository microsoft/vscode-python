// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { expect } from 'chai';
import * as typeMoq from 'typemoq';
import { WorkspaceConfiguration } from 'vscode';
import { LanguageServerPackageService } from '../../client/activation/languageServerPackageService';
import { IHttpClient, ILanguageServerPackageService } from '../../client/activation/types';
import { IWorkspaceService } from '../../client/common/application/types';
import { HttpClient } from '../../client/common/net/httpClient';
import { NugetRepo } from '../../client/common/nugetRepo';
import { IPlatformService } from '../../client/common/platform/types';
import { INugetRepo } from '../../client/common/types';
import { IServiceContainer } from '../../client/ioc/types';

suite('Language Server Package Service', () => {
    let serviceContainer: typeMoq.IMock<IServiceContainer>;
    let mockNugetRepo: typeMoq.IMock<INugetRepo>;
    let platform: typeMoq.IMock<IPlatformService>;
    let lsPackageService: ILanguageServerPackageService;
    setup(() => {
        serviceContainer = typeMoq.Mock.ofType<IServiceContainer>();
        mockNugetRepo = typeMoq.Mock.ofType<INugetRepo>();
        platform = typeMoq.Mock.ofType<IPlatformService>();
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(INugetRepo))).returns(() => mockNugetRepo.object);
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(IPlatformService))).returns(() => platform.object);

        lsPackageService = new LanguageServerPackageService(serviceContainer.object);
    });
    test('Ensure new Major versions of Language Server is account for', async () => {
        let maxMajorVersion = 0;
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
        expect(nugetPackageBaseAddress.length).to.be.greaterThan(0);
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
});
