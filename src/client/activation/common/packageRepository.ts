// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { AzureBlobStoreNugetRepository } from '../../common/nuget/azureBlobStoreNugetRepository';
import { IServiceContainer } from '../../ioc/types';

export const azureBlobStorageAccount = 'https://pvsc.blob.core.windows.net';
const azureCDNBlobStorageAccount = 'https://pvsc.azureedge.net';

export enum LanguageServerDownloadChannel {
    stable = 'stable',
    beta = 'beta',
    daily = 'daily'
}

export abstract class StableLanguageServerPackageRepository extends AzureBlobStoreNugetRepository {
    constructor(serviceContainer: IServiceContainer, packageName: string) {
        super(serviceContainer, azureBlobStorageAccount, `${packageName}-${LanguageServerDownloadChannel.stable}}`, azureCDNBlobStorageAccount);
    }
}

export abstract class BetaLanguageServerPackageRepository extends AzureBlobStoreNugetRepository {
    constructor(serviceContainer: IServiceContainer, packageName: string) {
        super(serviceContainer, azureBlobStorageAccount, `${packageName}-${LanguageServerDownloadChannel.beta}}`, azureCDNBlobStorageAccount);
    }
}

export abstract class DailyLanguageServerPackageRepository extends AzureBlobStoreNugetRepository {
    constructor(serviceContainer: IServiceContainer, packageName: string) {
        super(serviceContainer, azureBlobStorageAccount, `${packageName}-${LanguageServerDownloadChannel.daily}}`, azureCDNBlobStorageAccount);
    }
}
