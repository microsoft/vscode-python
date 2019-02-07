// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as vsls from 'vsls/vscode';

import { ILiveShareApi } from '../../../common/application/types';
import { IAsyncDisposable } from '../../../common/types';
import { ClassType } from '../../../ioc/types';

// tslint:disable:no-any
export class RoleBasedFactory<T extends IAsyncDisposable, CtorType extends ClassType<T>> {
    private ctorArgs : any[];
    private firstTime : boolean = true;
    private createPromise : Promise<T> | undefined;

    constructor(private liveShare: ILiveShareApi, private noneCtor : CtorType, private hostCtor: CtorType, private guestCtor: CtorType, ...args: any[]) {
        this.ctorArgs = args;
    }

    public get() : Promise<T> {
        // Make sure only one create happens at a time
        if (this.createPromise) {
            return this.createPromise;
        }
        this.createPromise = this.createBasedOnRole();
        return this.createPromise;
    }

    private async createBasedOnRole() : Promise<T> {

        // Figure out our role to compute the object to create
        const api = await this.liveShare.getApi();
        let ctor : CtorType = this.noneCtor;

        if (api) {
            // Create based on role.
            if (api.session && api.session.role === vsls.Role.Host) {
                ctor = this.hostCtor;
            } else if (api.session && api.session.role === vsls.Role.Guest) {
                ctor = this.guestCtor;
            }
        }

        // Create our object
        const obj = new ctor(...this.ctorArgs);

        // Rewrite the object's dispose so we can get rid of our own state.
        const oldDispose = obj.dispose.bind(obj);
        obj.dispose = () => {
            this.createPromise = undefined;
            return oldDispose();
        };

        // If the session changes, also dispose
        if (api && this.firstTime) {
            this.firstTime = false;
            api.onDidChangeSession((a) => obj.dispose());
        }

        return obj;
    }
}
