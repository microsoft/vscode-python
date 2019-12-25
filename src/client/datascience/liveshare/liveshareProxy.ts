// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Disposable, Event, TreeDataProvider, Uri } from 'vscode';
import * as vsls from 'vsls/vscode';

import { IApplicationShell } from '../../common/application/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { LiveShare, LiveShareCommands } from '../constants';
import { ServiceProxy } from './serviceProxy';

// tslint:disable:no-any unified-signatures
export class LiveShareProxy implements vsls.LiveShare {
    private currentRole: vsls.Role = vsls.Role.None;
    private guestChecker: vsls.SharedService | vsls.SharedServiceProxy | null = null;
    private pendingGuestCheckCount = 0;
    private peerCheckPromise: Deferred<boolean> | undefined;
    constructor(
        private applicationShell: IApplicationShell,
        private peerTimeout: number | undefined,
        private realApi: vsls.LiveShare
    ) {
        this.realApi.onDidChangePeers(this.onPeersChanged, this);
        this.realApi.onDidChangeSession(this.onSessionChanged, this);
        this.onSessionChanged({ session: this.realApi.session }).ignoreErrors();
    }
    public get session(): vsls.Session {
        return this.realApi.session;
    }
    public get onDidChangeSession(): Event<vsls.SessionChangeEvent> {
        return this.realApi.onDidChangeSession;
    }
    public get peers(): vsls.Peer[] {
        return this.realApi.peers;
    }
    public get onDidChangePeers(): Event<vsls.PeersChangeEvent> {
        return this.realApi.onDidChangePeers;
    }
    public share(options?: vsls.ShareOptions | undefined): Promise<Uri | null> {
        return this.realApi.share(options);
    }
    public join(link: Uri, options?: vsls.JoinOptions | undefined): Promise<void> {
        return this.realApi.join(link, options);
    }
    public end(): Promise<void> {
        return this.realApi.end();
    }
    public async shareService(name: string): Promise<vsls.SharedService | null> {
        // Create the real shared service.
        const realService = await this.realApi.shareService(name);

        // Create a proxy for the shared service. This allows us to wait for the next request/response
        // on the shared service to cause a failure when the guest doesn't have the python extension installed.
        if (realService) {
            return new ServiceProxy(realService, () => this.peersAreOkay(), () => this.forceShutdown());
        }

        return realService;
    }
    public unshareService(name: string): Promise<void> {
        return this.realApi.unshareService(name);
    }
    public getSharedService(name: string): Promise<vsls.SharedServiceProxy | null> {
        return this.realApi.getSharedService(name);
    }
    public convertLocalUriToShared(localUri: Uri): Uri {
        return this.realApi.convertLocalUriToShared(localUri);
    }
    public convertSharedUriToLocal(sharedUri: Uri): Uri {
        return this.realApi.convertSharedUriToLocal(sharedUri);
    }
    public registerCommand(command: string, isEnabled?: (() => boolean) | undefined, thisArg?: any): Disposable | null {
        return this.realApi.registerCommand(command, isEnabled, thisArg);
    }
    public registerTreeDataProvider<T>(viewId: vsls.View, treeDataProvider: TreeDataProvider<T>): Disposable | null {
        return this.realApi.registerTreeDataProvider(viewId, treeDataProvider);
    }
    public registerContactServiceProvider(name: string, contactServiceProvider: vsls.ContactServiceProvider): Disposable | null {
        return this.realApi.registerContactServiceProvider(name, contactServiceProvider);
    }
    public shareServer(server: vsls.Server): Promise<Disposable> {
        return this.realApi.shareServer(server);
    }
    public getContacts(emails: string[]): Promise<vsls.ContactsCollection> {
        return this.realApi.getContacts(emails);
    }

    private async onSessionChanged(ev: vsls.SessionChangeEvent): Promise<void> {
        const newRole = ev.session ? ev.session.role : vsls.Role.None;
        if (this.currentRole !== newRole) {
            // Setup our guest checker service.
            if (this.currentRole === vsls.Role.Host) {
                await this.realApi.unshareService(LiveShare.GuestCheckerService);
            }
            this.currentRole = newRole;

            // If host, we need to listen for responses
            if (this.currentRole === vsls.Role.Host) {
                this.guestChecker = await this.realApi.shareService(LiveShare.GuestCheckerService);
                if (this.guestChecker) {
                    this.guestChecker.onNotify(LiveShareCommands.guestCheck, (_args: object) => this.onGuestResponse());
                }

                // If guest, we need to list for requests.
            } else if (this.currentRole === vsls.Role.Guest) {
                this.guestChecker = await this.realApi.getSharedService(LiveShare.GuestCheckerService);
                if (this.guestChecker) {
                    this.guestChecker.onNotify(LiveShareCommands.guestCheck, (_args: object) => this.onHostRequest());
                }
            }
        }
    }

    private onPeersChanged(_ev: vsls.PeersChangeEvent) {
        if (this.currentRole === vsls.Role.Host && this.guestChecker) {
            // Update our pending count. This means we need to ask again if positive.
            this.pendingGuestCheckCount = this.realApi.peers.length;
            this.peerCheckPromise = undefined;
        }
    }

    private peersAreOkay(): Promise<boolean> {
        // If already asking, just use that promise
        if (this.peerCheckPromise) {
            return this.peerCheckPromise.promise;
        }

        // Shortcut if we don't need to ask.
        if (!this.guestChecker || this.currentRole !== vsls.Role.Host || this.pendingGuestCheckCount <= 0) {
            return Promise.resolve(true);
        }

        // We need to ask each guest then.
        this.peerCheckPromise = createDeferred<boolean>();
        this.guestChecker.notify(LiveShareCommands.guestCheck, {});

        // Wait for a second and then check
        setTimeout(this.validatePendingGuests.bind(this), this.peerTimeout ? this.peerTimeout : 1000);
        return this.peerCheckPromise.promise;
    }

    private validatePendingGuests() {
        if (this.peerCheckPromise && !this.peerCheckPromise.resolved) {
            this.peerCheckPromise.resolve(this.pendingGuestCheckCount <= 0);
        }
    }

    private onGuestResponse() {
        // Guest has responded to a guest check. Update our pending count
        this.pendingGuestCheckCount -= 1;
        if (this.pendingGuestCheckCount <= 0 && this.peerCheckPromise) {
            this.peerCheckPromise.resolve(true);
        }
    }

    private onHostRequest() {
        // Host is asking us to respond
        if (this.guestChecker && this.currentRole === vsls.Role.Guest) {
            this.guestChecker.notify(LiveShareCommands.guestCheck, {});
        }
    }

    private forceShutdown() {
        // One or more guests doesn't have the python extension installed. Force our live share session to disconnect
        this.realApi.end().then(() => {
            this.pendingGuestCheckCount = 0;
            this.peerCheckPromise = undefined;
            this.applicationShell.showErrorMessage(localize.DataScience.liveShareInvalid());
        }).ignoreErrors();
    }
}
