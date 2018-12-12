// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { SemVer } from 'semver';
import * as typeMoq from 'typemoq';
import { LanguageServerPackageStorageContainers } from '../../../client/activation/languageServer/languageServerPackageRepository';
import { LanguageServerPackageService } from '../../../client/activation/languageServer/languageServerPackageService';
import { IHttpClient } from '../../../client/activation/types';
import { IApplicationEnvironment } from '../../../client/common/application/types';
import { AzureBlobStoreNugetRepository } from '../../../client/common/nuget/azureBlobStoreNugetRepository';
import { INugetService } from '../../../client/common/nuget/types';
import { PlatformService } from '../../../client/common/platform/platformService';
import { IServiceContainer } from '../../../client/ioc/types';

const azureBlobStorageAccount = 'https://pvsc.blob.core.windows.net';
const azureCDNBlobStorageAccount = 'https://pvsc.azureedge.net';

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

        repo = new AzureBlobStoreNugetRepository(serviceContainer.object, azureBlobStorageAccount, defaultStorageChannel, azureCDNBlobStorageAccount);
    });

    test('Get all packages', async function () {
        // tslint:disable-next-line:no-invalid-this
        this.timeout(15000);
        const platformService = new PlatformService();
        const packageJson = { languageServerVersion: '0.1.0' };
        const appEnv = typeMoq.Mock.ofType<IApplicationEnvironment>();
        appEnv.setup(e => e.packageJson).returns(() => packageJson);
        const lsPackageService = new LanguageServerPackageService(serviceContainer.object, appEnv.object, platformService);
        const packageName = lsPackageService.getNugetPackageName();
        const packages = await repo.getPackages(packageName);

        expect(packages).to.be.length.greaterThan(0);
    });
});
