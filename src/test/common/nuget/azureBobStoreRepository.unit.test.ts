// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { BlobService, ErrorOrResult } from 'azure-storage';
import { expect } from 'chai';
import { SemVer } from 'semver';
import * as typeMoq from 'typemoq';
import { WorkspaceConfiguration } from 'vscode';
import { IWorkspaceService } from '../../../client/common/application/types';
import { AzureBlobStoreNugetRepository } from '../../../client/common/nuget/azureBlobStoreNugetRepository';
import { INugetService } from '../../../client/common/nuget/types';
import { IServiceContainer } from '../../../client/ioc/types';

suite('Nuget Azure Storage Repository', () => {
    const packageName = 'Python-Language-Server-???';

    let serviceContainer: typeMoq.IMock<IServiceContainer>;
    let workspace: typeMoq.IMock<IWorkspaceService>;
    let nugetService: typeMoq.IMock<INugetService>;
    let cfg: typeMoq.IMock<WorkspaceConfiguration>;

    setup(() => {
        serviceContainer = typeMoq.Mock.ofType<IServiceContainer>(undefined, typeMoq.MockBehavior.Strict);
        workspace = typeMoq.Mock.ofType<IWorkspaceService>(undefined, typeMoq.MockBehavior.Strict);
        nugetService = typeMoq.Mock.ofType<INugetService>(undefined, typeMoq.MockBehavior.Strict);
        cfg = typeMoq.Mock.ofType<WorkspaceConfiguration>(undefined, typeMoq.MockBehavior.Strict);

        serviceContainer.setup((c) => c.get(typeMoq.It.isValue(INugetService))).returns(() => nugetService.object);
    });

    class FakeBlobStore {
        public calls: [string, string, any][] = [];
        public results?: BlobService.BlobResult[];
        public error?: Error;
        public contructor() {
            this.calls = [];
        }
        public listBlobsSegmentedWithPrefix(
            c: string,
            p: string,

            t: any,
            cb: ErrorOrResult<BlobService.ListBlobsResult>,
        ) {
            this.calls.push([c, p, t]);
            const result: BlobService.ListBlobsResult = { entries: this.results! };

            cb(this.error as Error, result, undefined as any);
        }
    }

    const tests: [string, boolean, string][] = [
        ['https://az', true, 'https://az'],
        ['https://az', false, 'http://az'],
        ['http://az', true, 'http://az'],
        ['http://az', false, 'http://az'],
    ];
    for (const [uri, setting, expected] of tests) {
        test(`Get all packages ("${uri}" / ${setting})`, async () => {
            if (uri.startsWith('https://')) {
                serviceContainer
                    .setup((c) => c.get(typeMoq.It.isValue(IWorkspaceService)))
                    .returns(() => workspace.object);
                workspace.setup((w) => w.getConfiguration('http', undefined)).returns(() => cfg.object);
                cfg.setup((c) => c.get('proxyStrictSSL', true)).returns(() => setting);
            }
            const blobstore = new FakeBlobStore();

            blobstore.results = [
                { name: 'Azarath' } as BlobService.BlobResult,
                { name: 'Metrion' } as BlobService.BlobResult,
                { name: 'Zinthos' } as BlobService.BlobResult,
            ];

            const version = new SemVer('1.1.1');
            blobstore.results.forEach((r) => {
                nugetService.setup((n) => n.getVersionFromPackageFileName(r.name)).returns(() => version);
            });
            let actualURI = '';
            const repo = new AzureBlobStoreNugetRepository(
                serviceContainer.object,
                uri,
                'spam',
                'eggs',
                async (uriArg) => {
                    actualURI = uriArg;
                    return blobstore;
                },
            );

            const packages = await repo.getPackages(packageName, undefined);

            expect(packages).to.deep.equal([
                { package: 'Azarath', uri: 'eggs/spam/Azarath', version: version },
                { package: 'Metrion', uri: 'eggs/spam/Metrion', version: version },
                { package: 'Zinthos', uri: 'eggs/spam/Zinthos', version: version },
            ]);
            expect(actualURI).to.equal(expected);
            expect(blobstore.calls).to.deep.equal([['spam', packageName, undefined]], 'failed');
            serviceContainer.verifyAll();
            workspace.verifyAll();
            cfg.verifyAll();
        });
    }
});
