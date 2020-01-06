// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Disposable, Event } from 'vscode';
import * as vsls from 'vsls/vscode';

import { createDeferred } from '../../../common/utils/async';

export async function waitForHostService(api: vsls.LiveShare, name: string): Promise<vsls.SharedService | null> {
    const service = await api.shareService(name);
    if (service && !service.isServiceAvailable) {
        return waitForAvailability(service);
    }
    return service;
}

export async function waitForGuestService(api: vsls.LiveShare, name: string): Promise<vsls.SharedServiceProxy | null> {
    const service = await api.getSharedService(name);
    if (service && !service.isServiceAvailable) {
        return waitForAvailability(service);
    }
    return service;
}

interface IChangeWatchable {
    readonly onDidChangeIsServiceAvailable: Event<boolean>;
}

async function waitForAvailability<T extends IChangeWatchable>(service: T): Promise<T> {
    const deferred = createDeferred<T>();
    let disposable: Disposable | undefined;
    try {
        disposable = service.onDidChangeIsServiceAvailable(e => {
            if (e) {
                deferred.resolve(service);
            }
        });
        await deferred.promise;
    } finally {
        if (disposable) {
            disposable.dispose();
        }
    }
    return service;
}
