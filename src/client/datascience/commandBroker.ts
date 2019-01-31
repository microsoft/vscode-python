// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';

import { IDisposableRegistry } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { IHistory, IHistoryProvider, ICommandBroker } from './types';
import { ICommandManager } from '../common/application/types';
import { ICommand } from '../providers/jediProxy';
import { Disposable, TextEditor, TextEditorEdit } from 'vscode';
import * as vsls from 'vsls/vscode';
import { LiveShare } from './constants';

// This class acts as a broker between the VSCode command manager and a potential live share session
// It works like so:
// -- If not connected to any live share session, then just register commands as normal
// -- If a host, register commands as normal (as they will be listened to), but when they are hit, post them to all guests
// -- If a guest, register commands as normal (as they will be ignored), but also register for notifications from the host.
@injectable()
export class CommandBroker implements ICommandBroker {

    private started : Promise<vsls.LiveShare | undefined>;
    private hostServer : vsls.SharedService | undefined;
    private guestServer : vsls.SharedServiceProxy | undefined;
    private currentRole : vsls.Role = vsls.Role.None;
    private commandMap : { [key: string] : (...args: any[]) => void } = {};

    constructor(
        @inject(ICommandManager) private commandManager: ICommandManager) {
        this.started = this.startCommandServer();
    }

    registerCommand(command: string, callback: (...args: any[]) => void, thisArg?: any): Disposable {
        // Modify the callback such that it sends the command to our service if necessary
        const disposable = this.commandManager.registerCommand(command, (args: any[]) => this.wrapCallback(command, callback, thisArg, args), thisArg);

        // Potentially register this for notification lookup on the guest side
        this.registerForGuest(command, callback).ignoreErrors();

        return disposable;
    }
    registerTextEditorCommand(command: string, callback: (textEditor: TextEditor, edit: TextEditorEdit, ...args: any[]) => void, thisArg?: any): Disposable {
        // Modify the callback such that it sends the command to our service if necessary
        const disposable = this.commandManager.registerCommand(
            command,
            (textEditor: TextEditor, edit: TextEditorEdit, args: any[]) => this.wrapTextEditorCallback(command, callback, textEditor, edit, thisArg, args), thisArg);

        // Potentially register this for notification lookup on the guest side
        this.registerForGuest(command, callback).ignoreErrors();

        return disposable;
    }
    executeCommand<T>(command: string, ...rest: any[]): Thenable<T> {
        // Execute the command but potentially also send to our service too
        this.postCommand<T>(command, rest).ignoreErrors();
        return this.commandManager.executeCommand(command, rest);
    }
    getCommands(filterInternal?: boolean): Thenable<string[]> {
        // This does not go across to the other side. Just return the command registered locally
        return this.commandManager.getCommands(filterInternal);
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
                    api.unshareService(LiveShare.CommandBrokerService);
                    this.hostServer = undefined;
                }
                if (this.guestServer) {
                    this.guestServer = undefined;
                }
            }

            // Startup our proxy or server
            this.currentRole = api.session.role;
            if (api.session.role === vsls.Role.Host) {
                this.hostServer = await api.shareService(LiveShare.CommandBrokerService);
            } else if (api.session.role === vsls.Role.Guest) {
                this.guestServer = await api.getSharedService(LiveShare.CommandBrokerService);

                // When we switch to guest mode, we may have to reregister all of our commands.
                this.registerGuestCommands(api);
            }
        }
    }

    private async registerForGuest(command: string, callback: (...args: any[]) => void) : Promise<void> {
        const api = await this.started;
        if (api && api.session && api.session.role === vsls.Role.Guest) {
            this.guestServer.onNotify(command, callback);
        }

        // Always stick in the command map so that if we switch roles, we reregister
        this.commandMap[command] = callback;
    }

    private registerGuestCommands(api: vsls.LiveShare) {
        if (api && api.session && api.session.role === vsls.Role.Guest) {
            const keys = Object.keys(this.commandMap);
            keys.forEach(k => {
                this.guestServer.onNotify(k, this.commandMap[k]);
            })
        }
    }

    private wrapCallback(command: string, callback: (...args: any[]) => void, thisArg?: any, ...args: any[]) {
        // First send to the host (this should happen automatically as the host is the only one that can actually register)
        if (thisArg) {
            thisArg.callback(args);
        } else {
            callback(args);
        }

        // Then post a notification that the command was run
        this.postCommand(command, args).ignoreErrors();
    }

    private wrapTextEditorCallback(command: string, callback: (textEditor: TextEditor, edit: TextEditorEdit,...args: any[]) => void, textEditor: TextEditor, edit: TextEditorEdit, thisArg: any, ...args: any[]) {
        // First send to the host (this should happen automatically as the host is the only one that can actually register)
        if (thisArg) {
            thisArg.callback(args);
        } else {
            callback(textEditor, edit, args);
        }

        // Then post a notification that the command was run
        this.postCommand(command, args).ignoreErrors();
    }

    private async postCommand<T>(command: string, ...rest: any[]): Promise<void> {
        // Make sure startup finished
        const api = await this.started;
        if (api && api.session && this.currentRole === vsls.Role.Host) {
            // This means we should send this across to the other side.
            this.hostServer.notify(command, rest);
        }
    }
}
