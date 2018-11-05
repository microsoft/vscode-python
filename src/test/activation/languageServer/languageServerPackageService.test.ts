// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any no-invalid-this max-func-body-length

import { expect } from 'chai';
import * as typeMoq from 'typemoq';
import { WorkspaceConfiguration } from 'vscode';
import { LanguageServerPackageStorageContainers } from '../../../client/activation/languageServer/languageServerPackageRepository';
import { LanguageServerPackageService } from '../../../client/activation/languageServer/languageServerPackageService';
import { IHttpClient } from '../../../client/activation/types';
import { IApplicationEnvironment, IWorkspaceService } from '../../../client/common/application/types';
import { HttpClient } from '../../../client/common/net/httpClient';
import { AzureBlobStoreNugetRepository } from '../../../client/common/nuget/azureBlobStoreNugetRepository';
import { NugetRepository } from '../../../client/common/nuget/nugetRepository';
import { NugetService } from '../../../client/common/nuget/nugetService';
import { INugetRepository, INugetService } from '../../../client/common/nuget/types';
import { PlatformService } from '../../../client/common/platform/platformService';
import { IPlatformService } from '../../../client/common/platform/types';
import { IServiceContainer } from '../../../client/ioc/types';

const azureBlobStorageAccount = 'https://pvsc.blob.core.windows.net';
const azureCDNBlobStorageAccount = 'https://pvsc.azureedge.net';

suite('Language Server Package Service', () => {
    let serviceContainer: typeMoq.IMock<IServiceContainer>;
    setup(() => {
        serviceContainer = typeMoq.Mock.ofType<IServiceContainer>();
    });
    test('Ensure new Major versions of Language Server is accounted for (nuget)', async function () {
        const skipped = true;
        if (skipped) {
            // tslint:disable-next-line:no-suspicious-comment
            // TODO: Why was this skipped?  See gh-2615.
            return this.skip();
        }

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
        serviceContainer.setup(a => a.get(typeMoq.It.isValue(IWorkspaceService))).returns(() => workSpaceService.object);

        const nugetService = new NugetService();
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(INugetService))).returns(() => nugetService);
        const httpClient = new HttpClient(serviceContainer.object);
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(IHttpClient))).returns(() => httpClient);
        const platformService = new PlatformService();
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(IPlatformService))).returns(() => platformService);
        const nugetRepo = new NugetRepository(serviceContainer.object);
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(INugetRepository))).returns(() => nugetRepo);
        const appEnv = typeMoq.Mock.ofType<IApplicationEnvironment>();
        const packageJson = { languageServerVersion: '0.1.0' };
        appEnv.setup(e => e.packageJson).returns(() => packageJson);
        const lsPackageService = new LanguageServerPackageService(serviceContainer.object, appEnv.object);

        const packageName = lsPackageService.getNugetPackageName();
        const packages = await nugetRepo.getPackages(packageName);

        const latestReleases = packages
            .filter(item => nugetService.isReleaseVersion(item.version))
            .sort((a, b) => a.version.compare(b.version));
        const latestRelease = latestReleases[latestReleases.length - 1];

        config.verifyAll();
        workSpaceService.verifyAll();
        expect(packages).to.be.length.greaterThan(0, 'No packages returned.');
        expect(latestReleases).to.be.length.greaterThan(0, 'No release packages returned.');
        expect(latestRelease.version.major).to.be.equal(lsPackageService.maxMajorVersion, 'New Major version of Language server has been released, we need to update it at our end.');
    });
    test('Ensure new Major versions of Language Server is accounted for (azure blob)', async () => {
        const nugetService = new NugetService();
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(INugetService))).returns(() => nugetService);
        const platformService = new PlatformService();
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(IPlatformService))).returns(() => platformService);
        const defaultStorageChannel = LanguageServerPackageStorageContainers.stable;
        const nugetRepo = new AzureBlobStoreNugetRepository(serviceContainer.object, azureBlobStorageAccount, defaultStorageChannel, azureCDNBlobStorageAccount);
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(INugetRepository))).returns(() => nugetRepo);
        const appEnv = typeMoq.Mock.ofType<IApplicationEnvironment>();
        const packageJson = { languageServerVersion: '0.1.0' };
        appEnv.setup(e => e.packageJson).returns(() => packageJson);
        const lsPackageService = new LanguageServerPackageService(serviceContainer.object, appEnv.object);
        const packageName = lsPackageService.getNugetPackageName();
        const packages = await nugetRepo.getPackages(packageName);

        const latestReleases = packages
            .filter(item => nugetService.isReleaseVersion(item.version))
            .sort((a, b) => a.version.compare(b.version));
        const latestRelease = latestReleases[latestReleases.length - 1];

        expect(packages).to.be.length.greaterThan(0, 'No packages returned.');
        expect(latestReleases).to.be.length.greaterThan(0, 'No release packages returned.');
        expect(latestRelease.version.major).to.be.equal(lsPackageService.maxMajorVersion, 'New Major version of Language server has been released, we need to update it at our end.');
    });
});
