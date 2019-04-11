// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { SemVer } from 'semver';
import * as typeMoq from 'typemoq';
import { WorkspaceConfiguration } from 'vscode';
import { LanguageServerPackageStorageContainers } from '../../../client/activation/languageServer/languageServerPackageRepository';
import { LanguageServerPackageService } from '../../../client/activation/languageServer/languageServerPackageService';
import { IHttpClient } from '../../../client/activation/types';
import { IApplicationEnvironment, IWorkspaceService } from '../../../client/common/application/types';
import { AzureBlobStoreNugetRepository } from '../../../client/common/nuget/azureBlobStoreNugetRepository';
import { INugetService } from '../../../client/common/nuget/types';
import { PlatformService } from '../../../client/common/platform/platformService';
import { IServiceContainer } from '../../../client/ioc/types';

suite('Nuget Azure Storage Repository', () => {
    const azureBlobStorageAccount = 'https://pvsc.blob.core.windows.net';
    const azureCDNBlobStorageAccount = 'https://pvsc.azureedge.net';
    const defaultStorageChannel = LanguageServerPackageStorageContainers.stable;

    let serviceContainer: typeMoq.IMock<IServiceContainer>;
    let httpClient: typeMoq.IMock<IHttpClient>;
    let workspace: typeMoq.IMock<IWorkspaceService>;
    let cfg: typeMoq.IMock<WorkspaceConfiguration>;

    let repo: AzureBlobStoreNugetRepository;
    let strictSSL: boolean;

    setup(() => {
        serviceContainer = typeMoq.Mock.ofType<IServiceContainer>(undefined, typeMoq.MockBehavior.Strict);
        httpClient = typeMoq.Mock.ofType<IHttpClient>(undefined, typeMoq.MockBehavior.Strict);
        workspace = typeMoq.Mock.ofType<IWorkspaceService>(undefined, typeMoq.MockBehavior.Strict);
        const nugetService = typeMoq.Mock.ofType<INugetService>(undefined, typeMoq.MockBehavior.Strict);
        cfg = typeMoq.Mock.ofType<WorkspaceConfiguration>(undefined, typeMoq.MockBehavior.Strict);

        serviceContainer.setup(c => c.get(typeMoq.It.isValue(IHttpClient)))
            .returns(() => httpClient.object);
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(IWorkspaceService)))
            .returns(() => workspace.object);
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(INugetService)))
            .returns(() => nugetService.object);

        nugetService.setup(n => n.getVersionFromPackageFileName(typeMoq.It.isAny()))
            .returns(() => new SemVer('1.1.1'));
        workspace.setup(w => w.getConfiguration('http', undefined))
            .returns(() => cfg.object);
        cfg.setup(c => c.get('proxyStrictSSL', true))
            .returns(() => strictSSL);

        repo = new AzureBlobStoreNugetRepository(
            serviceContainer.object,
            azureBlobStorageAccount,
            defaultStorageChannel,
            azureCDNBlobStorageAccount
        );
        strictSSL = true;
    });

    test('Get all packages (HTTPS)', async function () {
        // tslint:disable-next-line:no-invalid-this
        this.timeout(15000);
        const platformService = new PlatformService();
        const packageJson = { languageServerVersion: '0.1.0' };
        const appEnv = typeMoq.Mock.ofType<IApplicationEnvironment>();
        appEnv.setup(e => e.packageJson).returns(() => packageJson);
        const lsPackageService = new LanguageServerPackageService(serviceContainer.object, appEnv.object, platformService);
        const packageName = lsPackageService.getNugetPackageName();
        const packages = await repo.getPackages(packageName, undefined);

        expect(packages).to.be.length.greaterThan(0);
    });

    test('Get all packages (HTTP)', async function () {
        // tslint:disable-next-line:no-invalid-this
        this.timeout(15000);
        strictSSL = false;
        const platformService = new PlatformService();
        const packageJson = { languageServerVersion: '0.1.0' };
        const appEnv = typeMoq.Mock.ofType<IApplicationEnvironment>();
        appEnv.setup(e => e.packageJson).returns(() => packageJson);
        const lsPackageService = new LanguageServerPackageService(serviceContainer.object, appEnv.object, platformService);
        const packageName = lsPackageService.getNugetPackageName();
        const packages = await repo.getPackages(packageName, undefined);

        expect(packages).to.be.length.greaterThan(0);
    });
});
