// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as vsls from 'vsls/vscode';
import { LiveShare } from '../constants';
import { IDisposable } from '../../common/types';

// This class is used to register two communication between a host and all of its guests
export class PostOffice implements IDisposable {

    private name: string;
    private started : Promise<vsls.LiveShare | undefined>;
    private hostServer : vsls.SharedService | undefined;
    private guestServer : vsls.SharedServiceProxy | undefined;
    private currentRole : vsls.Role = vsls.Role.None;
    private commandMap : { [key: string] : (role: vsls.Role, ...args: any[]) => void } = {};

    constructor(name: string) {
        this.name = name;
        this.started = this.startCommandServer();
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
        if (api && api.session) {
            switch (this.currentRole) {
                case vsls.Role.Guest:
                    // Ask host to broadcast
                    this.guestServer.notify(LiveShare.LiveShareBroadcastRequest, [command, ...args]);
                    break;
                case vsls.Role.Host:
                    // Notify everybody and call our local callback (by falling through)
                    this.hostServer.notify(command, args);
                default:
                    // Default when not connected is to just call the registered callback
                    if (this.commandMap.hasOwnProperty(command)) {
                        this.commandMap[command](this.currentRole, ...args);
                    }
            }
        }
    }

    public async registerCallback(command: string, callback: (role: vsls.Role, ...args: any[]) => void) : Promise<void> {
        const api = await this.started;

        // For a guest, make sure to register the notification
        if (api && api.session && api.session.role === vsls.Role.Guest) {
            this.guestServer.onNotify(command, (a) => callback(this.currentRole, a));
        }

        // Always stick in the command map so that if we switch roles, we reregister
        this.commandMap[command] = callback;

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
                this.hostServer.onNotify(LiveShare.LiveShareBroadcastRequest, this.onBroadcastRequest);
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
                this.guestServer.onNotify(k, (a) => this.commandMap[k](this.currentRole, a));
            })
        }
    }

}
