// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, unmanaged } from 'inversify';
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
        @inject(IServiceContainer) private readonly serviceContainer: IServiceContainer,
        @unmanaged() protected readonly azureBlobStorageAccount: string,
        @unmanaged() protected readonly azureBlobStorageContainer: string,
        @unmanaged() protected readonly azureCDNBlobStorageAccount: string
    ) { }
    public async getPackages(packageName: string, resource: Resource): Promise<NugetPackage[]> {
        return this.listPackages(
            this.azureBlobStorageAccount,
            this.azureBlobStorageContainer,
            packageName,
            this.azureCDNBlobStorageAccount,
            resource
        );
    }

    @captureTelemetry(EventName.PYTHON_LANGUAGE_SERVER_LIST_BLOB_STORE_PACKAGES)
    @traceDecorators.verbose('Listing Nuget Packages')
    protected async listPackages(
        azureBlobStorageAccount: string,
        azureBlobStorageContainer: string,
        packageName: string,
        azureCDNBlobStorageAccount: string,
        resource: Resource
    ) {
        const blobStore = await this.getBlobStore(azureBlobStorageAccount, resource);
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
                    resolve(this.convertResults(
                        result.entries,
                        azureCDNBlobStorageAccount,
                        azureBlobStorageContainer,
                        nugetService
                    ));
                });
        });
    }
    private convertResults(
        results: IBlobResult[],
        azureCDNBlobStorageAccount: string,
        azureBlobStorageContainer: string,
        nugetService: INugetService
    ): NugetPackage[] {
        return results.map(item => {
            return {
                package: item.name,
                uri: `${azureCDNBlobStorageAccount}/${azureBlobStorageContainer}/${item.name}`,
                version: nugetService.getVersionFromPackageFileName(item.name)
            };
        });
    }
    private async getBlobStore(uri: string, resource: Resource) {
        if (uri.startsWith('https:')) {
            const workspace = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
            const cfg = workspace.getConfiguration('http', resource);
            if (!cfg.get<boolean>('proxyStrictSSL', true)) {
                // tslint:disable-next-line:no-http-string
                uri = uri.replace(/^https:/, 'http:');
            }
        }
        return _getAZBlobStore(uri);
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
    const az = await import('azure-storage') as typeof import('azure-storage');
    return az.createBlobServiceAnonymous(uri);
}
