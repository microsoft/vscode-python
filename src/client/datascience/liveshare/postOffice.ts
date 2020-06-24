// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import type { JSONArray } from '@phosphor/coreutils';
import * as vscode from 'vscode';
import * as vsls from 'vsls/vscode';

import { ILiveShareApi } from '../../common/application/types';
import { traceInfo } from '../../common/logger';
import { IAsyncDisposable } from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import { LiveShare } from '../constants';

// tslint:disable:no-any

interface IMessageArgs {
    args: string;
}

// This class is used to register two communication between a host and all of its guests
export class PostOffice implements IAsyncDisposable {
    private name: string;
    private startedPromise: Deferred<vsls.LiveShare | null> | undefined;
    private hostServer: vsls.SharedService | null = null;
    private guestServer: vsls.SharedServiceProxy | null = null;
    private currentRole: vsls.Role = vsls.Role.None;
    private currentPeerCount: number = 0;
    private peerCountChangedEmitter: vscode.EventEmitter<number> = new vscode.EventEmitter<number>();
    private commandMap: { [key: string]: { thisArg: any; callback(...args: any[]): void } } = {};

    constructor(
        name: string,
        private liveShareApi: ILiveShareApi,
        private hostArgsTranslator?: (api: vsls.LiveShare | null, command: string, role: vsls.Role, args: any[]) => void
    ) {
        this.name = name;

        // Note to self, could the callbacks be keeping things alive that we don't want to be alive?
    }

    public get peerCount() {
        return this.currentPeerCount;
    }

    public get peerCountChanged(): vscode.Event<number> {
        return this.peerCountChangedEmitter.event;
    }

    public get role() {
        return this.currentRole;
    }

    public async dispose() {
        this.peerCountChangedEmitter.fire(0);
        this.peerCountChangedEmitter.dispose();
        if (this.hostServer) {
            traceInfo(`Shutting down live share api`);
            const s = await this.getApi();
            if (s !== null) {
                await s.unshareService(this.name);
            }
            this.hostServer = null;
        }
        this.guestServer = null;
    }

    public async postCommand(command: string, ...args: any[]): Promise<void> {
        // Make sure startup finished
        const api = await this.getApi();
        let skipDefault = false;

        if (api && api.session) {
            switch (this.currentRole) {
                case vsls.Role.Guest:
                    // Ask host to broadcast
                    if (this.guestServer) {
                        this.guestServer.notify(
                            LiveShare.LiveShareBroadcastRequest,
                            this.createBroadcastArgs(command, ...args)
                        );
                    }
                    skipDefault = true;
                    break;
                case vsls.Role.Host:
                    // Notify everybody and call our local callback (by falling through)
                    if (this.hostServer) {
                        this.hostServer.notify(
                            this.escapeCommandName(command),
                            this.translateArgs(api, command, ...args)
                        );
                    }
                    break;
                default:
                    break;
            }
        }

        if (!skipDefault) {
            // Default when not connected is to just call the registered callback
            this.callCallback(command, ...args);
        }
    }

    public async registerCallback(command: string, callback: (...args: any[]) => void, thisArg?: any): Promise<void> {
        const api = await this.getApi();

        // For a guest, make sure to register the notification
        if (api && api.session && api.session.role === vsls.Role.Guest && this.guestServer) {
            this.guestServer.onNotify(this.escapeCommandName(command), (a) =>
                this.onGuestNotify(command, a as IMessageArgs)
            );
        }

        // Always stick in the command map so that if we switch roles, we reregister
        this.commandMap[command] = { callback, thisArg };
    }

    private createBroadcastArgs(command: string, ...args: any[]): IMessageArgs {
        return { args: JSON.stringify([command, ...args]) };
    }

    private translateArgs(api: vsls.LiveShare, command: string, ...args: any[]): IMessageArgs {
        // Make sure to eliminate all .toJSON functions on our arguments. Otherwise they're stringified incorrectly
        for (let a = 0; a <= args.length; a += 1) {
            // Eliminate this on only object types (https://stackoverflow.com/questions/8511281/check-if-a-value-is-an-object-in-javascript)
            if (args[a] === Object(args[a])) {
                args[a].toJSON = undefined;
            }
        }

        // Copy our args so we don't affect callers.
        const copyArgs = JSON.parse(JSON.stringify(args));

        // Some file path args need to have their values translated to guest
        // uri format for use on a guest. Try to find any file arguments
        const callback = this.commandMap.hasOwnProperty(command) ? this.commandMap[command].callback : undefined;
        if (callback) {
            // Give the passed in args translator a chance to attempt a translation
            if (this.hostArgsTranslator) {
                this.hostArgsTranslator(api, command, vsls.Role.Host, copyArgs);
            }
        }

        // Then wrap them all up in a string.
        return { args: JSON.stringify(copyArgs) };
    }

    private escapeCommandName(command: string): string {
        // Replace . with $ instead.
        return command.replace(/\./g, '$');
    }

    private unescapeCommandName(command: string): string {
        // Turn $ back into .
        return command.replace(/\$/g, '.');
    }

    private onGuestNotify = (command: string, m: IMessageArgs) => {
        const unescaped = this.unescapeCommandName(command);
        const args = JSON.parse(m.args) as JSONArray;
        this.callCallback(unescaped, ...args);
    };

    private callCallback(command: string, ...args: any[]) {
        const callback = this.getCallback(command);
        if (callback) {
            callback(...args);
        }
    }

    private getCallback(command: string): ((...args: any[]) => void) | undefined {
        let callback = this.commandMap.hasOwnProperty(command) ? this.commandMap[command].callback : undefined;
        if (callback) {
            // Bind the this arg if necessary
            const thisArg = this.commandMap[command].thisArg;
            if (thisArg) {
                callback = callback.bind(thisArg);
            }
        }

        return callback;
    }

    private getApi(): Promise<vsls.LiveShare | null> {
        if (!this.startedPromise) {
            this.startedPromise = createDeferred<vsls.LiveShare | null>();
            this.startCommandServer()
                .then((v) => this.startedPromise!.resolve(v))
                .catch((e) => this.startedPromise!.reject(e));
        }

        return this.startedPromise.promise;
    }

    private async startCommandServer(): Promise<vsls.LiveShare | null> {
        const api = await this.liveShareApi.getApi();
        if (api !== null) {
            api.onDidChangeSession(() => this.onChangeSession(api).ignoreErrors());
            api.onDidChangePeers(() => this.onChangePeers(api).ignoreErrors());
            await this.onChangeSession(api);
            await this.onChangePeers(api);
        }
        return api;
    }

    private async onChangeSession(api: vsls.LiveShare): Promise<void> {
        // Startup or shutdown our connection to the other side
        if (api.session) {
            if (this.currentRole !== api.session.role) {
                // We're changing our role.
                if (this.hostServer) {
                    await api.unshareService(this.name);
                    this.hostServer = null;
                }
                if (this.guestServer) {
                    this.guestServer = null;
                }
            }

            // Startup our proxy or server
            this.currentRole = api.session.role;
            if (api.session.role === vsls.Role.Host) {
                this.hostServer = await api.shareService(this.name);

                // When we start the host, listen for the broadcast message
                if (this.hostServer !== null) {
                    this.hostServer.onNotify(LiveShare.LiveShareBroadcastRequest, (a) =>
                        this.onBroadcastRequest(api, a as IMessageArgs)
                    );
                }
            } else if (api.session.role === vsls.Role.Guest) {
                this.guestServer = await api.getSharedService(this.name);

                // When we switch to guest mode, we may have to reregister all of our commands.
                this.registerGuestCommands(api);
            }
        }
    }

    private async onChangePeers(api: vsls.LiveShare): Promise<void> {
        let newPeerCount = 0;
        if (api.session) {
            newPeerCount = api.peers.length;
        }
        if (newPeerCount !== this.currentPeerCount) {
            this.peerCountChangedEmitter.fire(newPeerCount);
            this.currentPeerCount = newPeerCount;
        }
    }

    private onBroadcastRequest = (api: vsls.LiveShare, a: IMessageArgs) => {
        // This means we need to rebroadcast a request. We should also handle this request ourselves (as this means
        // a guest is trying to tell everybody about a command)
        if (a.args.length > 0) {
            const jsonArray = JSON.parse(a.args) as JSONArray;
            if (jsonArray !== null && jsonArray.length >= 2) {
                const firstArg = jsonArray[0]!; // More stupid hygiene problems.
                const command = firstArg !== null ? firstArg.toString() : '';

                // Args need to be translated from guest to host
                const rest = jsonArray.slice(1);
                if (this.hostArgsTranslator) {
                    this.hostArgsTranslator(api, command, vsls.Role.Guest, rest);
                }

                this.postCommand(command, ...rest).ignoreErrors();
            }
        }
    };

    private registerGuestCommands(api: vsls.LiveShare) {
        if (api && api.session && api.session.role === vsls.Role.Guest && this.guestServer !== null) {
            const keys = Object.keys(this.commandMap);
            keys.forEach((k) => {
                if (this.guestServer !== null) {
                    // Hygiene is too dumb to recognize the if above
                    this.guestServer.onNotify(this.escapeCommandName(k), (a) =>
                        this.onGuestNotify(k, a as IMessageArgs)
                    );
                }
            });
        }
    }
}
