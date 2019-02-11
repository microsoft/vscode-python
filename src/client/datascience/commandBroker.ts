// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import { Disposable, TextEditor, TextEditorEdit } from 'vscode';
import * as vsls from 'vsls/vscode';

import { ICommandManager, ILiveShareApi } from '../common/application/types';
import { LiveShare } from './constants';
import { PostOffice } from './liveshare/postOffice';
import { ICommandBroker } from './types';

// tslint:disable:no-any

// This class acts as a broker between the VSCode command manager and a potential live share session
// It works like so:
// -- If not connected to any live share session, then just register commands as normal
// -- If a host, register commands as normal (as they will be listened to), but when they are hit, post them to all guests
// -- If a guest, register commands as normal (as they will be ignored), but also register for notifications from the host.
@injectable()
export class CommandBroker implements ICommandBroker {

    private postOffice : PostOffice;
    constructor(
        @inject(ILiveShareApi) liveShare: ILiveShareApi,
        @inject(ICommandManager) private commandManager: ICommandManager) {
        this.postOffice = new PostOffice(LiveShare.CommandBrokerService, liveShare);
    }

    public registerCommand(command: string, callback: (...args: any[]) => void, thisArg?: any): Disposable {
        // Modify the callback such that it sends the command to our service
        const disposable = this.commandManager.registerCommand(command, (...args: any[]) => this.wrapCallback(command, callback, ...args), thisArg);

        // Register it for lookup
        this.register(command, callback, thisArg).ignoreErrors();

        return disposable;
    }
    public registerTextEditorCommand(command: string, callback: (textEditor: TextEditor, edit: TextEditorEdit, ...args: any[]) => void, thisArg?: any): Disposable {
        // Modify the callback such that it sends the command to our service
        const disposable = this.commandManager.registerCommand(
            command,
            (textEditor: TextEditor, edit: TextEditorEdit, ...args: any[]) => this.wrapTextEditorCallback(command, callback, textEditor, edit, ...args), thisArg);

        // Register it for lookup
        this.register(command, callback, thisArg).ignoreErrors();

        return disposable;
    }
    public executeCommand<T>(command: string, ...rest: any[]): Thenable<T | undefined> {
        // Execute the command but potentially also send to our service too
        this.postCommand<T>(command, ...rest).ignoreErrors();
        return this.commandManager.executeCommand(command, ...rest);
    }
    public getCommands(filterInternal?: boolean): Thenable<string[]> {
        // This does not go across to the other side. Just return the command registered locally
        return this.commandManager.getCommands(filterInternal);
    }

    private async register(command: string, callback: (...args: any[]) => void, thisArg?: any) : Promise<void> {
        return this.postOffice.registerCallback(command, callback, thisArg);
    }

    private wrapCallback(command: string, callback: (...args: any[]) => void, ...args: any[]) {
        // Have the post office handle it.
        this.postCommand(command, ...args).ignoreErrors();
    }

    private wrapTextEditorCallback(command: string, callback: (textEditor: TextEditor, edit: TextEditorEdit, ...args: any[]) => void, ...args: any[]) {
        // Not really supported at the moment as we don't have a special case for the textEditor. But not using it.
        this.postCommand(command, ...args).ignoreErrors();
    }

    private async postCommand<T>(command: string, ...rest: any[]): Promise<void> {
        // Make sure we're the host (or none). Guest shouldn't be sending
        if (this.postOffice.role() !== vsls.Role.Guest) {
            // This means we should send this across to the other side.
            return this.postOffice.postCommand(command, ...rest);
        }
    }
}
