// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { SemVer } from 'semver';
import * as typeMoq from 'typemoq';
import { LanguageServerPackageStorageContainers } from '../../../client/activation/languageServer/languageServerPackageRepository';
import { LanguageServerPackageService } from '../../../client/activation/languageServer/languageServerPackageService';
import { IHttpClient } from '../../../client/activation/types';
import { AzureBlobStoreNugetRepository } from '../../../client/common/nuget/azureBlobStoreNugetRepository';
import { INugetService } from '../../../client/common/nuget/types';
import { PlatformService } from '../../../client/common/platform/platformService';
import { IPlatformService } from '../../../client/common/platform/types';
import { IServiceContainer } from '../../../client/ioc/types';

suite('Nuget Azure Storage Repository', () => {
    let serviceContainer: typeMoq.IMock<IServiceContainer>;
    let httpClient: typeMoq.IMock<IHttpClient>;
    let repo: AzureBlobStoreNugetRepository;
    setup(() => {
        serviceContainer = typeMoq.Mock.ofType<IServiceContainer>();
        httpClient = typeMoq.Mock.ofType<IHttpClient>();
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(IHttpClient))).returns(() => httpClient.object);

        const nugetService = typeMoq.Mock.ofType<INugetService>();
        nugetService.setup(n => n.getVersionFromPackageFileName(typeMoq.It.isAny())).returns(() => new SemVer('1.1.1'));
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(INugetService))).returns(() => nugetService.object);
        const defaultStorageChannel = LanguageServerPackageStorageContainers.stable;

        repo = new AzureBlobStoreNugetRepository(serviceContainer.object, 'https://pvsc.blob.core.windows.net', defaultStorageChannel);
    });

    test('Get all packages', async function () {
        // tslint:disable-next-line:no-invalid-this
        this.timeout(15000);
        const platformService = new PlatformService();
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(IPlatformService))).returns(() => platformService);
        const lsPackageService = new LanguageServerPackageService(serviceContainer.object);
        const packageName = lsPackageService.getNugetPackageName();
        const packages = await repo.getPackages(packageName);

        expect(packages).to.be.length.greaterThan(0);
    });
});
