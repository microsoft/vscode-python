// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { injectable } from 'inversify';
import * as path from 'path';
import * as uuid from 'uuid/v4';
import { CancellationToken, CancellationTokenSource, Disposable, Event, EventEmitter, TreeDataProvider, Uri } from 'vscode';
import * as vsls from 'vsls/vscode';

import { ILiveShareTestingApi } from '../../client/common/application/types';
import { IDisposable } from '../../client/common/types';
import { noop } from '../../client/common/utils/misc';

// tslint:disable:no-any unified-signatures max-classes-per-file

class MockLiveService implements vsls.SharedService, vsls.SharedServiceProxy {
    public isServiceAvailable: boolean = true;
    private changeIsServiceAvailableEmitter: EventEmitter<boolean> = new EventEmitter<boolean>();
    private requestHandlers: Map<string, vsls.RequestHandler> = new Map<string, vsls.RequestHandler>();
    private notifyHandlers: Map<string, vsls.NotifyHandler> = new Map<string, vsls.NotifyHandler>();
    private defaultCancellationSource = new CancellationTokenSource();

    constructor(_name: string) {
        noop();
    }

    public get onDidChangeIsServiceAvailable(): Event<boolean> {
        return this.changeIsServiceAvailableEmitter.event;
    }
    public request(name: string, args: any[], cancellation?: CancellationToken): Promise<any> {
        // See if any handlers.
        const handler = this.requestHandlers.get(name);
        if (handler) {
            return handler(args, cancellation ? cancellation : this.defaultCancellationSource.token);
        }
        return Promise.resolve();
    }
    public onRequest(name: string, handler: vsls.RequestHandler): void {
        this.requestHandlers.set(name, handler);
    }
    public onNotify(name: string, handler: vsls.NotifyHandler): void {
        this.notifyHandlers.set(name, handler);
    }
    public notify(name: string, args: object): void {
        // See if any handlers.
        const handler = this.notifyHandlers.get(name);
        if (handler) {
            handler(args);
        }
    }
}

type ArgumentType = 'boolean' | 'number' | 'string' | 'object' | 'function' | 'array' | 'uri';

function checkArg(value: any, name: string, type?: ArgumentType) {
    if (!value) {
        throw new Error(`Argument \'${name}\' is required.`);
    } else if (type) {
        if (type === 'array') {
            if (!Array.isArray(value)) {
                throw new Error(`Argument \'${name}\' must be an array.`);
            }
        } else if (type === 'uri') {
            if (!(value instanceof Uri)) {
                throw new Error(`Argument \'${name}\' must be a Uri object.`);
            }
        } else if (type === 'object' && Array.isArray(value)) {
            throw new Error(`Argument \'${name}\' must be a a non-array object.`);
        } else if (typeof value !== type) {
            throw new Error(`Argument \'${name}\' must be type \'' + type + '\'.`);
        }
    }
}

type Listener = [Function, any] | Function;

class Emitter<T> {

    private _event: Event<T> | undefined;
    private _disposed: boolean = false;
    private _deliveryQueue: { listener: Listener; event?: T }[] = [];
    private _listeners: Listener[] = [];

    get event(): Event<T> {
        if (!this._event) {
            this._event = (listener: (e: T) => any, thisArgs?: any, disposables?: IDisposable[]) => {
                this._listeners.push(!thisArgs ? listener : [listener, thisArgs]);
                let result: IDisposable;
                result = {
                    dispose: () => {
                        result.dispose = noop;
                        if (!this._disposed) {
                            this._listeners = this._listeners.filter(l => l !== listener);
                        }
                    }
                };
                if (Array.isArray(disposables)) {
                    disposables.push(result);
                }

                return result;
            };
        }
        return this._event;
    }

    public async fire(event?: T): Promise<void> {
        if (this._listeners) {
            // put all [listener,event]-pairs into delivery queue
            // then emit all event. an inner/nested event might be
            // the driver of this

            if (!this._deliveryQueue) {
                this._deliveryQueue = [];
            }

            for (const l of this._listeners) {
                this._deliveryQueue.push({ listener: l, event });
            }

            while (this._deliveryQueue.length > 0) {
                const item = this._deliveryQueue.shift();
                let result: any;
                try {
                    if (item && item.listener) {
                        if (typeof item.listener === 'function') {
                            result = item.listener.call(undefined, item.event);
                        } else {
                            const func = item.listener[0];
                            if (func) {
                                result = func.call(item.listener[1], item.event);
                            }
                        }
                    }
                } catch (e) {
                    // Do nothinga
                }
                if (result) {
                    const promise = result as Promise<void>;
                    if (promise) {
                        await promise;
                    }
                }
            }
        }
    }

    public dispose() {
        if (this._listeners) {
            this._listeners = [];
        }
        if (this._deliveryQueue) {
            this._deliveryQueue = [];
        }
        this._disposed = true;
    }
}

class MockLiveShare implements vsls.LiveShare, vsls.Session, vsls.Peer {
    private static others: MockLiveShare[] = [];
    private static services: Map<string, MockLiveService> = new Map<string, MockLiveService>();
    private changeSessionEmitter = new Emitter<vsls.SessionChangeEvent>();
    private changePeersEmitter = new EventEmitter<vsls.PeersChangeEvent>();
    private currentPeers: vsls.Peer[] = [];
    private _id = uuid();
    private _peerNumber = 0;
    private _visibleRole = vsls.Role.None;
    constructor(private _role: vsls.Role) {
        this._peerNumber = _role === vsls.Role.Host ? 0 : 1;
        MockLiveShare.others.push(this);
    }

    public onPeerConnected(peer: MockLiveShare) {
        if (peer.role !== this.role) {
            this.currentPeers.push(peer);
            this.changePeersEmitter.fire({ added: [peer], removed: [] });
        }
    }

    public get session(): vsls.Session {
        return this;
    }

    public async start(): Promise<void> {
        this._visibleRole = this._role;

        // Special case, we need to wait for the fire to finish. This means
        // the real product can have a race condition between starting the session and registering commands?
        // Nope, because the guest side can't do anything until the session starts up.
        await this.changeSessionEmitter.fire({ session: this });
        if (this._role === vsls.Role.Guest) {
            for (const o of MockLiveShare.others) {
                if (o._id !== this._id) {
                    o.onPeerConnected(this);
                }
            }
        }
        return Promise.resolve();
    }

    public async stop(): Promise<void> {
        this._visibleRole = vsls.Role.None;

        await this.changeSessionEmitter.fire({ session: this });

        return Promise.resolve();
    }

    public getContacts(_emails: string[]): Promise<vsls.ContactsCollection> {
        throw new Error('Method not implemented.');
    }

    public get role(): vsls.Role {
        return this._visibleRole;
    }
    public get id(): string {
        return this._id;
    }
    public get peerNumber(): number {
        return this._peerNumber;
    }
    public get user(): vsls.UserInfo {
        return {
            displayName: 'Test',
            emailAddress: 'Test@Microsoft.Com',
            userName: 'Test',
            id: '0'
        };
    }
    public get access(): vsls.Access {
        return vsls.Access.None;
    }

    public get onDidChangeSession(): Event<vsls.SessionChangeEvent> {
        return this.changeSessionEmitter.event;
    }
    public get peers(): vsls.Peer[] {
        return this.currentPeers;
    }
    public get onDidChangePeers(): Event<vsls.PeersChangeEvent> {
        return this.changePeersEmitter.event;
    }
    public share(_options?: vsls.ShareOptions): Promise<Uri> {
        throw new Error('Method not implemented.');
    }
    public join(_link: Uri, _options?: vsls.JoinOptions): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public end(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public shareService(name: string): Promise<vsls.SharedService> {
        if (!MockLiveShare.services.has(name)) {
            MockLiveShare.services.set(name, new MockLiveService(name));
        }
        const service = MockLiveShare.services.get(name);
        if (!service) {
            throw new Error(`${name} failure to add service to map`);
        }
        return Promise.resolve(service);
    }
    public unshareService(name: string): Promise<void> {
        MockLiveShare.services.delete(name);
        return Promise.resolve();
    }
    public getSharedService(name: string): Promise<vsls.SharedServiceProxy> {
        if (!MockLiveShare.services.has(name)) {
            // Don't wait for the host to start. It shouldn't be necessary anyway.
            MockLiveShare.services.set(name, new MockLiveService(name));
        }
        const service = MockLiveShare.services.get(name);
        if (!service) {
            throw new Error(`${name} failure to add service to map`);
        }
        return Promise.resolve(service);
    }
    public convertLocalUriToShared(localUri: Uri): Uri {
        // Do the same checking that liveshare does
        checkArg(localUri, 'localUri', 'uri');

        if (this.session.role !== vsls.Role.Host) {
            throw new Error('Only the host role can convert shared URIs.');
        }

        const scheme = 'vsls';
        if (localUri.scheme === scheme) {
            throw new Error(`URI is already a ${scheme} URI: ${localUri}`);
        }

        if (localUri.scheme !== 'file') {
            throw new Error(`Not a workspace file URI: ${localUri}`);
        }

        const file = localUri.fsPath.includes('/') ? path.basename(localUri.fsPath) : localUri.fsPath;
        return Uri.parse(`vsls:${file}`);
    }
    public convertSharedUriToLocal(sharedUri: Uri): Uri {
        checkArg(sharedUri, 'sharedUri', 'uri');

        if (this.session.role !== vsls.Role.Host) {
            throw new Error('Only the host role can convert shared URIs.');
        }

        const scheme = 'vsls';
        if (sharedUri.scheme !== scheme) {
            throw new Error(
                `Not a shared URI: ${sharedUri}`);
        }

        return Uri.file(sharedUri.fsPath);
    }
    public registerCommand(_command: string, _isEnabled?: () => boolean, _thisArg?: any): Disposable {
        throw new Error('Method not implemented.');
    }
    public registerTreeDataProvider<T>(_viewId: vsls.View, _treeDataProvider: TreeDataProvider<T>): Disposable {
        throw new Error('Method not implemented.');
    }
    public registerContactServiceProvider(_name: string, _contactServiceProvider: vsls.ContactServiceProvider): Disposable {
        throw new Error('Method not implemented.');
    }
    public shareServer(_server: vsls.Server): Promise<Disposable> {
        // Ignore for now. We don't need to port forward during a test
        return Promise.resolve({ dispose: noop });
    }
}

@injectable()
export class MockLiveShareApi implements ILiveShareTestingApi {

    private currentRole: vsls.Role = vsls.Role.None;
    private currentApi: MockLiveShare | null = null;
    private sessionStarted = false;

    public getApi(): Promise<vsls.LiveShare | null> {
        return Promise.resolve(this.currentApi);
    }

    public forceRole(role: vsls.Role) {
        // Force a role on our live share api
        if (role !== this.currentRole) {
            this.currentApi = new MockLiveShare(role);
            this.currentRole = role;
        }
    }

    public async startSession(): Promise<void> {
        if (this.currentApi) {
            await this.currentApi.start();
            this.sessionStarted = true;
        } else {
            throw Error('Cannot start session without a role.');
        }
    }

    public async stopSession(): Promise<void> {
        if (this.currentApi) {
            await this.currentApi.stop();
            this.sessionStarted = false;
        } else {
            throw Error('Cannot start session without a role.');
        }
    }

    public get isSessionStarted(): boolean {
        return this.sessionStarted;
    }
}
