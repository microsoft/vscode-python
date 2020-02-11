// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as vscode from 'vscode';
import * as vsls from 'vsls/vscode';

import { ILiveShareApi } from '../../../common/application/types';
import { IAsyncDisposable } from '../../../common/types';
import { ClassType } from '../../../ioc/types';
import { ILiveShareHasRole, ILiveShareParticipant } from './types';

export interface IRoleBasedObject extends IAsyncDisposable, ILiveShareParticipant {}

// tslint:disable:no-any
export class RoleBasedFactory<T extends IRoleBasedObject, CtorType extends ClassType<T>> implements ILiveShareHasRole {
    private ctorArgs: ConstructorParameters<CtorType>[];
    private firstTime: boolean = true;
    private createPromise: Promise<T> | undefined;
    private sessionChangedEmitter = new vscode.EventEmitter<void>();
    private _role: vsls.Role = vsls.Role.None;

    constructor(
        private liveShare: ILiveShareApi,
        private hostCtor: CtorType,
        private guestCtor: CtorType,
        ...args: ConstructorParameters<CtorType>
    ) {
        this.ctorArgs = args;
        this.createPromise = this.createBasedOnRole(); // We need to start creation immediately or one side may call before we init.
    }

    public get sessionChanged(): vscode.Event<void> {
        return this.sessionChangedEmitter.event;
    }

    public get role(): vsls.Role {
        return this._role;
    }

    public get(): Promise<T> {
        // Make sure only one create happens at a time
        if (this.createPromise) {
            return this.createPromise;
        }
        this.createPromise = this.createBasedOnRole();
        return this.createPromise;
    }

    private async createBasedOnRole(): Promise<T> {
        // Figure out our role to compute the object to create. Default is host. This
        // allows for the host object to keep existing if we suddenly start a new session.
        // For a guest, starting a new session resets the entire workspace.
        const api = await this.liveShare.getApi();
        let ctor: CtorType = this.hostCtor;
        let role: vsls.Role = vsls.Role.Host;

        if (api) {
            // Create based on role.
            if (api.session && api.session.role === vsls.Role.Host) {
                ctor = this.hostCtor;
            } else if (api.session && api.session.role === vsls.Role.Guest) {
                ctor = this.guestCtor;
                role = vsls.Role.Guest;
            }
        }
        this._role = role;

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
            api.onDidChangeSession(_a => {
                // Dispose the object if the role changes
                const newRole =
                    api !== null && api.session && api.session.role === vsls.Role.Guest
                        ? vsls.Role.Guest
                        : vsls.Role.Host;
                if (newRole !== role) {
                    obj.dispose().ignoreErrors();
                }

                // Update the object with respect to the api
                if (!objDisposed) {
                    obj.onSessionChange(api).ignoreErrors();
                }

                // Fire our event indicating old data is no longer valid.
                if (newRole !== role) {
                    this.sessionChangedEmitter.fire();
                }
            });
            api.onDidChangePeers(e => {
                if (!objDisposed) {
                    obj.onPeerChange(e).ignoreErrors();
                }
            });
        }

        return obj;
    }
}
