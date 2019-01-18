// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, unmanaged } from 'inversify';
import { IServiceContainer } from '../../ioc/types';
import { captureTelemetry } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { traceDecorators } from '../logger';
import { INugetRepository, INugetService, NugetPackage } from './types';

@injectable()
export class AzureBlobStoreNugetRepository implements INugetRepository {
    constructor(@inject(IServiceContainer) private readonly serviceContainer: IServiceContainer,
        @unmanaged() protected readonly azureBlobStorageAccount: string,
        @unmanaged() protected readonly azureBlobStorageContainer: string,
        @unmanaged() protected readonly azureCDNBlobStorageAccount: string) { }
    public async getPackages(packageName: string): Promise<NugetPackage[]> {
        return this.listPackages(this.azureBlobStorageAccount, this.azureBlobStorageContainer, packageName, this.azureCDNBlobStorageAccount);
    }

    @captureTelemetry(EventName.PYTHON_LANGUAGE_SERVER_LIST_BLOB_STORE_PACKAGES)
    @traceDecorators.verbose('Listing Nuget Packages')
    protected async listPackages(azureBlobStorageAccount: string, azureBlobStorageContainer: string, packageName: string, azureCDNBlobStorageAccount: string) {
        // tslint:disable-next-line:no-require-imports
        const az = await import('azure-storage') as typeof import('azure-storage');
        const blobStore = az.createBlobServiceAnonymous(azureBlobStorageAccount);
        const nugetService = this.serviceContainer.get<INugetService>(INugetService);
        return new Promise<NugetPackage[]>((resolve, reject) => {
            // We must pass undefined according to docs, but type definition doesn't all it to be undefined or null!!!
            // tslint:disable-next-line:no-any
            const token = undefined as any;
            blobStore.listBlobsSegmentedWithPrefix(azureBlobStorageContainer, packageName, token,
                (error, result) => {
                    if (error) {
                        return reject(error);
                    }
                    resolve(result.entries.map(item => {
                        return {
                            package: item.name,
                            uri: `${azureCDNBlobStorageAccount}/${azureBlobStorageContainer}/${item.name}`,
                            version: nugetService.getVersionFromPackageFileName(item.name)
                        };
                    }));
                });
        });
    }
}
