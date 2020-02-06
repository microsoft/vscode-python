// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { injectable, unmanaged } from 'inversify';
import { IServiceContainer } from '../../ioc/types';
import { captureTelemetry } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { IWorkspaceService } from '../application/types';
import { traceDecorators } from '../logger';
import { Resource } from '../types';
import { INugetRepository, INugetService, NugetPackage } from './types';

@injectable()
export class AzureBlobStoreNugetRepository implements INugetRepository {
    constructor(
        @unmanaged() private readonly serviceContainer: IServiceContainer,
        @unmanaged() protected readonly azureBlobStorageAccount: string,
        @unmanaged() protected readonly azureBlobStorageContainer: string,
        @unmanaged() protected readonly azureCDNBlobStorageAccount: string,
        private getBlobStore: (uri: string) => Promise<IAZBlobStore> = _getAZBlobStore
    ) {}

    public async getPackages(packageName: string, resource: Resource): Promise<NugetPackage[]> {
        return this.listPackages(this.azureBlobStorageAccount, this.azureBlobStorageContainer, packageName, this.azureCDNBlobStorageAccount, resource);
    }

    @captureTelemetry(EventName.PYTHON_LANGUAGE_SERVER_LIST_BLOB_STORE_PACKAGES)
    @traceDecorators.verbose('Listing Nuget Packages')
    protected async listPackages(azureBlobStorageAccount: string, azureBlobStorageContainer: string, packageName: string, azureCDNBlobStorageAccount: string, resource: Resource) {
        const results = await this.listBlobStoreCatalog(this.fixBlobStoreURI(azureBlobStorageAccount, resource), azureBlobStorageContainer, packageName);
        const nugetService = this.serviceContainer.get<INugetService>(INugetService);
        return results.map(item => {
            return {
                package: item.name,
                uri: `${azureCDNBlobStorageAccount}/${azureBlobStorageContainer}/${item.name}`,
                version: nugetService.getVersionFromPackageFileName(item.name)
            };
        });
    }

    private async listBlobStoreCatalog(azureBlobStorageAccount: string, azureBlobStorageContainer: string, packageName: string): Promise<IBlobResult[]> {
        const blobStore = await this.getBlobStore(azureBlobStorageAccount);
        return new Promise<IBlobResult[]>((resolve, reject) => {
            // We must pass undefined according to docs, but type definition doesn't all it to be undefined or null!!!
            // tslint:disable-next-line:no-any
            const token = undefined as any;
            blobStore.listBlobsSegmentedWithPrefix(azureBlobStorageContainer, packageName, token, (error, result) => {
                if (error) {
                    return reject(error);
                }
                resolve(result.entries);
            });
        });
    }
    private fixBlobStoreURI(uri: string, resource: Resource) {
        if (!uri.startsWith('https:')) {
            return uri;
        }

        const workspace = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        const cfg = workspace.getConfiguration('http', resource);
        if (cfg.get<boolean>('proxyStrictSSL', true)) {
            return uri;
        }

        // tslint:disable-next-line:no-http-string
        return uri.replace(/^https:/, 'http:');
    }
}

// The "azure-storage" package is large enough that importing it has
// a significant impact on extension startup time.  So we import it
// lazily and deal with the consequences below.

interface IBlobResult {
    name: string;
}

interface IBlobResults {
    entries: IBlobResult[];
}

type ErrorOrResult<TResult> = (error: Error, result: TResult) => void;

interface IAZBlobStore {
    listBlobsSegmentedWithPrefix(
        container: string,
        prefix: string,
        // tslint:disable-next-line:no-any
        currentToken: any,
        callback: ErrorOrResult<IBlobResults>
    ): void;
}

async function _getAZBlobStore(uri: string): Promise<IAZBlobStore> {
    // tslint:disable-next-line:no-require-imports
    const az = (await import('azure-storage')) as typeof import('azure-storage');
    return az.createBlobServiceAnonymous(uri);
}
