// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { common, createBlobServiceAnonymous } from 'azure-storage';
import { inject, injectable } from 'inversify';
import { IServiceContainer } from '../../ioc/types';
import { INugetRepository, INugetService, NugetPackage } from './types';

const azureBlobStorageAccount = 'https://pvsc.blob.core.windows.net';
const azureBlobStorageContainer = 'python-language-server';

@injectable()
export class AzureBlobStoreNugetRepository implements INugetRepository {
    constructor(@inject(IServiceContainer) private readonly serviceContainer: IServiceContainer) { }
    public async getPackages(packageName: string): Promise<NugetPackage[]> {
        const blobStore = createBlobServiceAnonymous(azureBlobStorageAccount);
        const nugetService = this.serviceContainer.get<INugetService>(INugetService);
        return new Promise<NugetPackage[]>((resolve, reject) => {
            // We must pass undefined according to docs, but type definition doesn't all it to be undefined or null!!!
            // tslint:disable-next-line:no-any
            blobStore.listBlobsSegmentedWithPrefix(azureBlobStorageContainer, packageName, undefined as any as common.ContinuationToken, (error, result) => {
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
