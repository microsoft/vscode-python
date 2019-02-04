// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as vsls from 'vsls/vscode';
import { IAsyncDisposable } from '../../../common/types';
import { ClassType } from '../../../ioc/types';
import { Deferred, createDeferred } from '../../../common/utils/async';

export class RoleBasedFactory<T extends IAsyncDisposable> {
    private currentPromise : Deferred<T> | undefined;
    private ctorArgs : any[];

    constructor(private noneCtor : ClassType<T>, private hostCtor: ClassType<T>, private guestCtor: ClassType<T>, ...args: any[]) {
        this.ctorArgs = args;
        this.createBasedOnRole();
    }

    public get() : Promise<T> {
        return this.currentPromise!.promise;
    }

    private async createBasedOnRole() : Promise<void> {
        // First see if the current is created or not. We need to dispose of the last value.
        let firstTime = true;
        if (this.currentPromise) {
            const old = this.currentPromise;
            firstTime = false;
            this.currentPromise = createDeferred<T>();
            const r = await old.promise;
            await r.dispose();
        } else {
            this.currentPromise = createDeferred<T>();
        }

        // Then get our live share api
        const api = await vsls.getApi();
        if (api) {
            // Sign up for changes if this is the first time.
            if (firstTime) {
                api.onDidChangeSession((a) => this.createBasedOnRole().ignoreErrors());
            }
            // Create based on role.
            if (api.session && api.session.role === vsls.Role.Host) {
                this.currentPromise.resolve(new this.hostCtor(...this.ctorArgs));
            }
            if (api.session && api.session.role === vsls.Role.Guest) {
                this.currentPromise.resolve(new this.guestCtor(...this.ctorArgs));
            }
        }

        if (!this.currentPromise.resolved) {
            this.currentPromise.resolve(new this.noneCtor(...this.ctorArgs));
        }
    }
}


