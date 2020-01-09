// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IPersistentStateFactory } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { FolderVersionPair, IDownloadChannelRule } from '../types';

const lastCheckedForLSDateTimeCacheKey = 'LS.LAST.CHECK.TIME';
const frequencyForBetalLSDownloadCheck = 1000 * 60 * 60 * 24; // One day.

@injectable()
export class DownloadDailyChannelRule implements IDownloadChannelRule {
    public async shouldLookForNewLanguageServer(_currentFolder?: FolderVersionPair): Promise<boolean> {
        return true;
    }
}
@injectable()
export class DownloadStableChannelRule implements IDownloadChannelRule {
    public async shouldLookForNewLanguageServer(currentFolder?: FolderVersionPair): Promise<boolean> {
        return currentFolder ? false : true;
    }
}
@injectable()
export class DownloadBetaChannelRule implements IDownloadChannelRule {
    constructor(@inject(IServiceContainer) private readonly serviceContainer: IServiceContainer) {}
    public async shouldLookForNewLanguageServer(currentFolder?: FolderVersionPair): Promise<boolean> {
        // For beta, we do this only once a day.
        const stateFactory = this.serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
        const globalState = stateFactory.createGlobalPersistentState<boolean>(lastCheckedForLSDateTimeCacheKey, true, frequencyForBetalLSDownloadCheck);

        // If we have checked it in the last 24 hours, then ensure we don't do it again.
        if (globalState.value) {
            await globalState.updateValue(false);
            return true;
        }

        return !currentFolder || globalState.value;
    }
}
