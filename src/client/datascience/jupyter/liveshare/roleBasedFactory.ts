// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as vsls from 'vsls/vscode';

import { ILiveShareApi } from '../../../common/application/types';
import { IAsyncDisposable } from '../../../common/types';
import { ClassType } from '../../../ioc/types';
import { ILiveShareParticipant } from './types';

export interface IRoleBasedObject extends IAsyncDisposable, ILiveShareParticipant {

}

// tslint:disable:no-any
export class RoleBasedFactory<T extends IRoleBasedObject, CtorType extends ClassType<T>> {
    private ctorArgs : any[];
    private firstTime : boolean = true;
    private createPromise : Promise<T> | undefined;

    constructor(private liveShare: ILiveShareApi, private hostCtor: CtorType, private guestCtor: CtorType, ...args: any[]) {
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

        // Figure out our role to compute the object to create. Default is host. This
        // allows for the host object to keep existing if we suddenly start a new session.
        // For a guest, starting a new session resets the entire workspace.
        const api = await this.liveShare.getApi();
        let ctor : CtorType = this.hostCtor;
        let role : vsls.Role = vsls.Role.Host;

        if (api) {
            // Create based on role.
            if (api.session && api.session.role === vsls.Role.Host) {
                ctor = this.hostCtor;
            } else if (api.session && api.session.role === vsls.Role.Guest) {
                ctor = this.guestCtor;
                role = vsls.Role.Guest;
            }
        }

        // Create our object
        const obj = new ctor(...this.ctorArgs);

        // Rewrite the object's dispose so we can get rid of our own state.
        let objDisposed = false;
        const oldDispose = obj.dispose.bind(obj);
        obj.dispose = () => {
            objDisposed = true;
            this.createPromise = undefined;
            return oldDispose();
        };

        // If the session changes, tell the listener
        if (api && this.firstTime) {
            this.firstTime = false;
            api.onDidChangeSession((a) => {
                // Dispose the object if the role changes
                const newRole = api !== null && api.session && api.session.role === vsls.Role.Guest ?
                    vsls.Role.Guest : vsls.Role.Host;
                if (newRole !== role) {
                    obj.dispose().ignoreErrors();
                }

                // Update the object with respect to the api
                if (!objDisposed) {
                    obj.onSessionChange(api).ignoreErrors();
                }
            });
            api.onDidChangePeers((e) => {
                if (!objDisposed) {
                    obj.onPeerChange(e).ignoreErrors();
                }
            });
        }

        return obj;
    }
}
