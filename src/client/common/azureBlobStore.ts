// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { common, createBlobServiceAnonymous } from 'azure-storage';
import { injectable } from 'inversify';
import { AzureBlob, IAzureBlobStore } from './types';

@injectable()
export class AzureBlobStore implements IAzureBlobStore {
    public searhBlobs(baseContainerAddress: string, container: string, searchPrefix: string): Promise<AzureBlob[]> {
        const blobStore = createBlobServiceAnonymous(baseContainerAddress);
        return new Promise<AzureBlob[]>((resolve, reject) => {
            // Dirty azure api, we must pass undefined according to docs, but type definition doesn't all it to be undefined or null!!!
            // tslint:disable-next-line:no-any
            blobStore.listBlobsSegmentedWithPrefix(container, searchPrefix, undefined as any as common.ContinuationToken, (error, result) => {
                if (error) {
                    return reject(error);
                }
                resolve(result.entries.map(item => {
                    return {
                        name: item.name,
                        uri: `${baseContainerAddress}/${container}/${item.name}`
                    };
                }));
            });
        });
    }
}
