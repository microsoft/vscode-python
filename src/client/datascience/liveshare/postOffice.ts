// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { JSONArray } from '@phosphor/coreutils';
import * as uuid from 'uuid/v4';
import * as vscode from 'vscode';
import * as vsls from 'vsls/vscode';

import { ILiveShareApi } from '../../common/application/types';
import { IAsyncDisposable } from '../../common/types';
import { LiveShare, RegExpValues } from '../constants';

// tslint:disable:no-any

interface IMessageArgs {
    args: string;
}

// This class is used to register two communication between a host and all of its guests
export class PostOffice implements IAsyncDisposable {

    private name: string;
    private started : Promise<vsls.LiveShare | null>;
    private hostServer : vsls.SharedService | null = null;
    private guestServer : vsls.SharedServiceProxy | null = null;
    private currentRole : vsls.Role = vsls.Role.None;
    private commandMap : { [key: string] : { thisArg: any; callback(...args: any[]) : void } } = {};

    constructor(name: string, private liveShareApi: ILiveShareApi) {
        this.name = name;
        this.started = this.startCommandServer();

        // Note to self, could the callbacks be keeping things alive that we don't want to be alive?
    }

    public role = () => {
        return this.currentRole;
    }

    public async dispose() {
        if (this.hostServer) {
            const s = await this.started;
            if (s !== null) {
                await s.unshareService(this.name);
            }
            this.hostServer = null;
        }
        this.guestServer = null;
    }

    public async postCommand(command: string, ...args: any[]) : Promise<void> {
        // Make sure startup finished
        const api = await this.started;
        let skipDefault = false;

        // Every command should generate an extra arg - the id. This lets them
        // be sync'd between guest and host.
        const id = uuid();
        const modifiedArgs = [...args, id];

        if (api && api.session) {
            switch (this.currentRole) {
                case vsls.Role.Guest:
                    // Ask host to broadcast
                    if (this.guestServer) {
                        this.guestServer.notify(LiveShare.LiveShareBroadcastRequest, this.createBroadcastArgs(command, ...args));
                    }
                    skipDefault = true;
                    break;
                case vsls.Role.Host:
                    // Notify everybody and call our local callback (by falling through)
                    if (this.hostServer) {
                        this.hostServer.notify(this.escapeCommandName(command), this.translateArgs(api, command, ...modifiedArgs));
                    }
                    break;
                default:
                    break;
            }
        }

        if (!skipDefault) {
            // Default when not connected is to just call the registered callback
            this.callCallback(command, ...modifiedArgs);
        }
    }

    public async registerCallback(command: string, callback: (...args: any[]) => void, thisArg?: any) : Promise<void> {
        const api = await this.started;

        // For a guest, make sure to register the notification
        if (api && api.session && api.session.role === vsls.Role.Guest && this.guestServer) {
            this.guestServer.onNotify(this.escapeCommandName(command), a => this.onGuestNotify(command, a as IMessageArgs));
        }

        // Always stick in the command map so that if we switch roles, we reregister
        this.commandMap[command] = { callback, thisArg };

    }

    private createBroadcastArgs(command: string, ...args: any[]) : IMessageArgs {
        return { args: JSON.stringify([command, ...args]) };
    }

    private translateArgs(api: vsls.LiveShare, command: string, ...args: any[]) : IMessageArgs {
        // Some file path args need to have their values translated to guest
        // uri format for use on a guest. Try to find any file arguments
        const callback = this.commandMap.hasOwnProperty(command) ? this.commandMap[command].callback : undefined;
        if (callback) {
            const str = callback.toString();

            // Early check
            if (str.includes('file')) {
                const callbackArgs = str.match(RegExpValues.ParamsExractorRegEx);
                if (callbackArgs && callbackArgs.length > 1) {
                    const argNames = callbackArgs[1].match(RegExpValues.ArgsSplitterRegEx);
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

    private escapeCommandName(command: string) : string {
        // Replace . with $ instead.
        return command.replace(/\./g, '$');
    }

    private unescapeCommandName(command: string) : string {
        // Turn $ back into .
        return command.replace(/\$/g, '.');
    }

    private onGuestNotify = (command: string, m: IMessageArgs) => {
        const unescaped = this.unescapeCommandName(command);
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

    private async startCommandServer() : Promise<vsls.LiveShare | null> {
        const api = await this.liveShareApi.getApi();
        if (api !== null) {
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
                    this.hostServer.onNotify(LiveShare.LiveShareBroadcastRequest, a => this.onBroadcastRequest(a as IMessageArgs));
                }
            } else if (api.session.role === vsls.Role.Guest) {
                this.guestServer = await api.getSharedService(this.name);

                // When we switch to guest mode, we may have to reregister all of our commands.
                this.registerGuestCommands(api);
            }
        }
    }

    private onBroadcastRequest = (a: IMessageArgs) => {
        // This means we need to rebroadcast a request. We should also handle this request ourselves (as this means
        // a guest is trying to tell everybody about a command)
        if (a.args.length > 0) {
            const jsonArray = JSON.parse(a.args) as JSONArray;
            if (jsonArray !== null && jsonArray.length >= 2) {
                const firstArg = jsonArray[0]; // More stupid hygiene problems.
                const command = firstArg !== null ? firstArg!.toString() : '';
                this.postCommand(command, ...jsonArray.slice(1)).ignoreErrors();
            }
        }
    }

    private registerGuestCommands(api: vsls.LiveShare) {
        if (api && api.session && api.session.role === vsls.Role.Guest && this.guestServer !== null) {
            const keys = Object.keys(this.commandMap);
            keys.forEach(k => {
                if (this.guestServer !== null) { // Hygiene is too dumb to recognize the if above
                    this.guestServer.onNotify(this.escapeCommandName(k), a => this.onGuestNotify(k, a as IMessageArgs));
                }
            });
        }
    }

}
