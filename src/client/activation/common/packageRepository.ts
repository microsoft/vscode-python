// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { injectable } from 'inversify';
import { AzureBlobStoreNugetRepository } from '../../common/nuget/azureBlobStoreNugetRepository';
import { IServiceContainer } from '../../ioc/types';

export const azureBlobStorageAccount = 'https://pvsc.blob.core.windows.net';
export const azureCDNBlobStorageAccount = 'https://pvsc.azureedge.net';

export enum LanguageServerDownloadChannel {
    stable = 'stable',
    beta = 'beta',
    daily = 'daily'
}

@injectable()
export abstract class StableLanguageServerPackageRepository extends AzureBlobStoreNugetRepository {
    constructor(serviceContainer: IServiceContainer, packageName: string) {
        super(
            serviceContainer,
            azureBlobStorageAccount,
            `${packageName}-${LanguageServerDownloadChannel.stable}`,
            azureCDNBlobStorageAccount
        );
    }
}

@injectable()
export abstract class BetaLanguageServerPackageRepository extends AzureBlobStoreNugetRepository {
    constructor(serviceContainer: IServiceContainer, packageName: string) {
        super(
            serviceContainer,
            azureBlobStorageAccount,
            `${packageName}-${LanguageServerDownloadChannel.beta}`,
            azureCDNBlobStorageAccount
        );
    }
}

@injectable()
export abstract class DailyLanguageServerPackageRepository extends AzureBlobStoreNugetRepository {
    constructor(serviceContainer: IServiceContainer, packageName: string) {
        super(
            serviceContainer,
            azureBlobStorageAccount,
            `${packageName}-${LanguageServerDownloadChannel.daily}`,
            azureCDNBlobStorageAccount
        );
    }
}
