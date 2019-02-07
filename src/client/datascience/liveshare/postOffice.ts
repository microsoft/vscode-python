// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as vscode from 'vscode';
import * as vsls from 'vsls/vscode';
import { LiveShare } from '../constants';
import { IDisposable } from '../../common/types';
import { escapeCommandName, unescapeCommandName } from './util';
import { JSONArray } from '@phosphor/coreutils';

interface IMessageArgs {
    args: string;
}

// This class is used to register two communication between a host and all of its guests
export class PostOffice implements IDisposable {

    private name: string;
    private started : Promise<vsls.LiveShare | undefined>;
    private hostServer : vsls.SharedService | undefined;
    private guestServer : vsls.SharedServiceProxy | undefined;
    private currentRole : vsls.Role = vsls.Role.None;
    private commandMap : { [key: string] : { callback: (...args: any[]) => void; thisArg: any } } = {};

    constructor(name: string) {
        this.name = name;
        this.started = this.startCommandServer();

        // Note to self, could the callbacks be keeping things alive that we don't want to be alive?
    }

    public role = () => {
        return this.currentRole;
    }

    public dispose() {
        if (this.hostServer) {
            this.started.then(s => s.unshareService(this.name));
            this.hostServer = undefined;
        }
        this.guestServer = undefined;
    }

    public async postCommand(command: string, ...args: any[]) : Promise<void> {
        // Make sure startup finished
        const api = await this.started;
        let skipDefault = false;

        if (api && api.session) {
            switch (this.currentRole) {
                case vsls.Role.Guest:
                    // Ask host to broadcast
                    this.guestServer.notify(LiveShare.LiveShareBroadcastRequest, {args: [command, ...args]});
                    skipDefault = true;
                    break;
                case vsls.Role.Host:
                    // Notify everybody and call our local callback (by falling through)
                    this.hostServer.notify(escapeCommandName(command), this.translateArgs(api, command, ...args));
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

    public async registerCallback(command: string, callback: (...args: any[]) => void, thisArg?: any) : Promise<void> {
        const api = await this.started;

        // For a guest, make sure to register the notification
        if (api && api.session && api.session.role === vsls.Role.Guest) {
            this.guestServer.onNotify(escapeCommandName(command), (a : IMessageArgs) => this.onGuestNotify(command, a));
        }

        // Always stick in the command map so that if we switch roles, we reregister
        this.commandMap[command] = { callback, thisArg };

    }

    private translateArgs(api: vsls.LiveShare, command: string, ...args: any[]) : IMessageArgs {
        // Some file path args need to have their values translated to guest
        // uri format for use on a guest. Try to find any file arguments
        const callback = this.commandMap.hasOwnProperty(command) ? this.commandMap[command].callback : undefined;
        if (callback) {
            const str = callback.toString();

            // Early check
            if (str.includes('file')) {
                const callbackArgs = str.match(/\S+\((.*)\)\s*{/);
                if (callbackArgs && callbackArgs.length > 1) {
                    const argNames = callbackArgs[1].match(/([^\s,]+)/g);
                    if (argNames && argNames.length > 0) {
                        for (let i = 0; i < args.length; i += 1) {
                            if (argNames[i].includes('file')) {
                                const file = args[i];
                                if (typeof file === 'string') {
                                    args[i] = api.convertLocalUriToShared(vscode.Uri.file(file)).fsPath;
                                }
                            }
                        }
                    }
                }
            }
        }

        // Make sure to eliminate all .toJSON functions on our arguments. Otherwise they're stringified incorrectly
        for (let a = 0; a <= args.length; a += 1) {
            // Eliminate this on only object types (https://stackoverflow.com/questions/8511281/check-if-a-value-is-an-object-in-javascript)
            if (args[a] === Object(args[a])) {
                args[a].toJSON = undefined;
            }
        }

        // Then wrap them all up in a string.
        return { args: JSON.stringify(args) };
    }

    private onGuestNotify = (command: string, m: IMessageArgs) => {
        const unescaped = unescapeCommandName(command);
        const args = JSON.parse(m.args) as JSONArray;
        this.callCallback(unescaped, ...args);
    }

    private callCallback(command: string, ...args: any[]) {
        const callback = this.getCallback(command);
        if (callback) {
            callback(...args);
        }
    }

    private getCallback(command: string) : ((...args: any[]) => void) | undefined {
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

    private async startCommandServer() : Promise<vsls.LiveShare | undefined> {
        const api = await vsls.getApiAsync();
        if (api) {
            api.onDidChangeSession(() => this.onChangeSession(api).ignoreErrors());
            await this.onChangeSession(api);
        }
        return api;
    }

    private async onChangeSession(api: vsls.LiveShare) : Promise<void> {
        // Startup or shutdown our connection to the other side
        if (api.session) {
            if (this.currentRole !== api.session.role) {
                // We're changing our role.
                if (this.hostServer) {
                    api.unshareService(this.name);
                    this.hostServer = undefined;
                }
                if (this.guestServer) {
                    this.guestServer = undefined;
                }
            }

            // Startup our proxy or server
            this.currentRole = api.session.role;
            if (api.session.role === vsls.Role.Host) {
                this.hostServer = await api.shareService(this.name);

                // When we start the host, listen for the broadcast message
                this.hostServer.onNotify(LiveShare.LiveShareBroadcastRequest, (a : IMessageArgs) => this.onBroadcastRequest(...a.args));
            } else if (api.session.role === vsls.Role.Guest) {
                this.guestServer = await api.getSharedService(this.name);

                // When we switch to guest mode, we may have to reregister all of our commands.
                this.registerGuestCommands(api);
            }
        }
    }

    private onBroadcastRequest = (...args: any[]) => {
        // This means we need to rebroadcast a request. We should also handle this request ourselves (as this means
        // a guest is trying to tell everybody about a command)
        if (args.length > 0) {
            this.postCommand(args[0], args.slice(1)).ignoreErrors();
        }
    }

    private registerGuestCommands(api: vsls.LiveShare) {
        if (api && api.session && api.session.role === vsls.Role.Guest) {
            const keys = Object.keys(this.commandMap);
            keys.forEach(k => {
                this.guestServer.onNotify(escapeCommandName(k), (a : IMessageArgs) => this.onGuestNotify(k, a));
            })
        }
    }

}
