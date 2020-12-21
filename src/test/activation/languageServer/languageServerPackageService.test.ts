// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any no-invalid-this max-func-body-length

import { expect } from 'chai';
import * as typeMoq from 'typemoq';
import { WorkspaceConfiguration } from 'vscode';
import { DotNetLanguageServerMinVersionKey } from '../../../client/activation/languageServer/languageServerFolderService';
import { DotNetLanguageServerPackageService } from '../../../client/activation/languageServer/languageServerPackageService';
import { IApplicationEnvironment, IWorkspaceService } from '../../../client/common/application/types';
import { AzureBlobStoreNugetRepository } from '../../../client/common/nuget/azureBlobStoreNugetRepository';
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
    test('Ensure new Major versions of language server is accounted for (azure blob)', async () => {
        const nugetService = new NugetService();
        serviceContainer.setup((c) => c.get(typeMoq.It.isValue(INugetService))).returns(() => nugetService);
        const platformService = new PlatformService();
        serviceContainer.setup((c) => c.get(typeMoq.It.isValue(IPlatformService))).returns(() => platformService);
        const workspace = typeMoq.Mock.ofType<IWorkspaceService>();
        const cfg = typeMoq.Mock.ofType<WorkspaceConfiguration>();
        cfg.setup((c) => c.get('proxyStrictSSL', true)).returns(() => true);
        workspace.setup((w) => w.getConfiguration('http', undefined)).returns(() => cfg.object);
        serviceContainer.setup((c) => c.get(typeMoq.It.isValue(IWorkspaceService))).returns(() => workspace.object);
        const defaultStorageChannel = 'python-language-server-daily';
        const nugetRepo = new AzureBlobStoreNugetRepository(
            serviceContainer.object,
            azureBlobStorageAccount,
            defaultStorageChannel,
            azureCDNBlobStorageAccount,
        );
        serviceContainer.setup((c) => c.get(typeMoq.It.isValue(INugetRepository))).returns(() => nugetRepo);
        const appEnv = typeMoq.Mock.ofType<IApplicationEnvironment>();
        const packageJson = { [DotNetLanguageServerMinVersionKey]: '0.0.1' };
        appEnv.setup((e) => e.packageJson).returns(() => packageJson);
        const platform = typeMoq.Mock.ofType<IPlatformService>();
        const lsPackageService = new DotNetLanguageServerPackageService(
            serviceContainer.object,
            appEnv.object,
            platform.object,
        );
        const packageName = lsPackageService.getNugetPackageName();
        const packages = await nugetRepo.getPackages(packageName, undefined);

        const latestReleases = packages
            .filter((item) => nugetService.isReleaseVersion(item.version))
            .sort((a, b) => a.version.compare(b.version));
        const latestRelease = latestReleases[latestReleases.length - 1];

        expect(packages).to.be.length.greaterThan(0, 'No packages returned.');
        expect(latestReleases).to.be.length.greaterThan(0, 'No release packages returned.');
        expect(latestRelease.version.major).to.be.equal(
            lsPackageService.maxMajorVersion,
            'New Major version of Language server has been released, we need to update it at our end.',
        );
    });
});
