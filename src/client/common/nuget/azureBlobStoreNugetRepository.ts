// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { common, createBlobServiceAnonymous } from 'azure-storage';
import { inject, injectable, unmanaged } from 'inversify';
import { IServiceContainer } from '../../ioc/types';
import { log, LogOptions } from '../logger';
import { INugetRepository, INugetService, NugetPackage } from './types';

@injectable()
export class AzureBlobStoreNugetRepository implements INugetRepository {
    constructor(@inject(IServiceContainer) private readonly serviceContainer: IServiceContainer,
        @unmanaged() protected readonly azureBlobStorageAccount: string,
        @unmanaged() protected readonly azureBlobStorageContainer: string) { }
    public async getPackages(packageName: string): Promise<NugetPackage[]> {
        return this.listPackages(this.azureBlobStorageAccount, this.azureBlobStorageContainer, packageName);
    }

    @log('Listing Nuget Packages', LogOptions.Arguments)
    public listPackages(azureBlobStorageAccount: string, azureBlobStorageContainer: string, packageName: string) {
        const blobStore = createBlobServiceAnonymous(azureBlobStorageAccount);
        const nugetService = this.serviceContainer.get<INugetService>(INugetService);
        return new Promise<NugetPackage[]>((resolve, reject) => {
            // We must pass undefined according to docs, but type definition doesn't all it to be undefined or null!!!
            // tslint:disable-next-line:no-any
            const token = undefined as any as common.ContinuationToken;
            blobStore.listBlobsSegmentedWithPrefix(azureBlobStorageContainer, packageName, token,
                (error, result) => {
                    if (error) {
                        return reject(error);
                    }
                    resolve(result.entries.map(item => {
                        return {
                            package: item.name,
                            uri: `${azureBlobStorageAccount}/${azureBlobStorageContainer}/${item.name}`,
                            version: nugetService.getVersionFromPackageFileName(item.name)
                        };
                    }));
                });
        });
    }
}
