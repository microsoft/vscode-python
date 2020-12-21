// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { SemVer } from 'semver';
import * as typeMoq from 'typemoq';
import { WorkspaceConfiguration } from 'vscode';
import { DotNetLanguageServerMinVersionKey } from '../../../client/activation/languageServer/languageServerFolderService';
import { DotNetLanguageServerPackageService } from '../../../client/activation/languageServer/languageServerPackageService';
import { IApplicationEnvironment, IWorkspaceService } from '../../../client/common/application/types';
import { AzureBlobStoreNugetRepository } from '../../../client/common/nuget/azureBlobStoreNugetRepository';
import { INugetService } from '../../../client/common/nuget/types';
import { PlatformService } from '../../../client/common/platform/platformService';
import { IHttpClient } from '../../../client/common/types';
import { IServiceContainer } from '../../../client/ioc/types';

const azureBlobStorageAccount = 'https://pvsc.blob.core.windows.net';
const azureCDNBlobStorageAccount = 'https://pvsc.azureedge.net';

suite('Nuget Azure Storage Repository', () => {
    let serviceContainer: typeMoq.IMock<IServiceContainer>;
    let httpClient: typeMoq.IMock<IHttpClient>;
    let workspace: typeMoq.IMock<IWorkspaceService>;
    let cfg: typeMoq.IMock<WorkspaceConfiguration>;
    let repo: AzureBlobStoreNugetRepository;
    setup(() => {
        serviceContainer = typeMoq.Mock.ofType<IServiceContainer>();
        httpClient = typeMoq.Mock.ofType<IHttpClient>();
        serviceContainer.setup((c) => c.get(typeMoq.It.isValue(IHttpClient))).returns(() => httpClient.object);
        cfg = typeMoq.Mock.ofType<WorkspaceConfiguration>();
        cfg.setup((c) => c.get('proxyStrictSSL', true)).returns(() => true);
        workspace = typeMoq.Mock.ofType<IWorkspaceService>();
        workspace.setup((w) => w.getConfiguration('http', undefined)).returns(() => cfg.object);
        serviceContainer.setup((c) => c.get(typeMoq.It.isValue(IWorkspaceService))).returns(() => workspace.object);

        const nugetService = typeMoq.Mock.ofType<INugetService>();
        nugetService
            .setup((n) => n.getVersionFromPackageFileName(typeMoq.It.isAny()))
            .returns(() => new SemVer('1.1.1'));
        serviceContainer.setup((c) => c.get(typeMoq.It.isValue(INugetService))).returns(() => nugetService.object);
        const defaultStorageChannel = 'python-language-server-stable';

        repo = new AzureBlobStoreNugetRepository(
            serviceContainer.object,
            azureBlobStorageAccount,
            defaultStorageChannel,
            azureCDNBlobStorageAccount,
        );
    });

    test('Get all packages', async function () {
        // tslint:disable-next-line:no-invalid-this
        this.timeout(15000);
        const platformService = new PlatformService();
        const packageJson = { [DotNetLanguageServerMinVersionKey]: '0.0.1' };
        const appEnv = typeMoq.Mock.ofType<IApplicationEnvironment>();
        appEnv.setup((e) => e.packageJson).returns(() => packageJson);
        const lsPackageService = new DotNetLanguageServerPackageService(
            serviceContainer.object,
            appEnv.object,
            platformService,
        );
        const packageName = lsPackageService.getNugetPackageName();
        const packages = await repo.getPackages(packageName, undefined);

        expect(packages).to.be.length.greaterThan(0);
    });
});
