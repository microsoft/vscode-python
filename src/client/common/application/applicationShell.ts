// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

// tslint:disable:no-require-imports no-var-requires no-any unified-signatures
const opn = require('opn');

import { injectable } from 'inversify';
import { CancellationToken, Disposable, InputBoxOptions, MessageItem, MessageOptions, OpenDialogOptions, QuickPickItem, QuickPickOptions, SaveDialogOptions, StatusBarAlignment, StatusBarItem, Uri, window, WorkspaceFolder, WorkspaceFolderPickOptions } from 'vscode';
import { IApplicationShell } from './types';

@injectable()
export class ApplicationShell implements IApplicationShell {
    public showInformationMessage(message: string, ...items: string[]): Thenable<string>;
    public showInformationMessage(message: string, options: MessageOptions, ...items: string[]): Thenable<string>;
    public showInformationMessage<T extends MessageItem>(message: string, ...items: T[]): Thenable<T>;
    public showInformationMessage<T extends MessageItem>(message: string, options: MessageOptions, ...items: T[]): Thenable<T>;
    public showInformationMessage(message: string, options?: any, ...items: any[]): Thenable<any> {
        return window.showInformationMessage(message, options, ...items);
    }

    public showWarningMessage(message: string, ...items: string[]): Thenable<string>;
    public showWarningMessage(message: string, options: MessageOptions, ...items: string[]): Thenable<string>;
    public showWarningMessage<T extends MessageItem>(message: string, ...items: T[]): Thenable<T>;
    public showWarningMessage<T extends MessageItem>(message: string, options: MessageOptions, ...items: T[]): Thenable<T>;
    public showWarningMessage(message: any, options?: any, ...items: any[]) {
        return window.showWarningMessage(message, options, ...items);
    }

    public showErrorMessage(message: string, ...items: string[]): Thenable<string>;
    public showErrorMessage(message: string, options: MessageOptions, ...items: string[]): Thenable<string>;
    public showErrorMessage<T extends MessageItem>(message: string, ...items: T[]): Thenable<T>;
    public showErrorMessage<T extends MessageItem>(message: string, options: MessageOptions, ...items: T[]): Thenable<T>;
    public showErrorMessage(message: any, options?: any, ...items: any[]) {
        return window.showErrorMessage(message, options, ...items);
    }

    public showQuickPick(items: string[] | Thenable<string[]>, options?: QuickPickOptions, token?: CancellationToken): Thenable<string>;
    public showQuickPick<T extends QuickPickItem>(items: T[] | Thenable<T[]>, options?: QuickPickOptions, token?: CancellationToken): Thenable<T>;
    public showQuickPick(items: any, options?: any, token?: any): Thenable<any> {
        return window.showQuickPick(items, options, token);
    }

    public showOpenDialog(options: OpenDialogOptions): Thenable<Uri[] | undefined> {
        return window.showOpenDialog(options);
    }
    public showSaveDialog(options: SaveDialogOptions): Thenable<Uri | undefined> {
        return window.showSaveDialog(options);
    }
    public showInputBox(options?: InputBoxOptions, token?: CancellationToken): Thenable<string | undefined> {
        return window.showInputBox(options, token);
    }
    public openUrl(url: string): void {
        opn(url);
    }

    public setStatusBarMessage(text: string, hideAfterTimeout: number): Disposable;
    public setStatusBarMessage(text: string, hideWhenDone: Thenable<any>): Disposable;
    public setStatusBarMessage(text: string): Disposable;
    public setStatusBarMessage(text: string, arg?: any): Disposable {
        return window.setStatusBarMessage(text, arg);
    }

    public createStatusBarItem(alignment?: StatusBarAlignment, priority?: number): StatusBarItem {
        return window.createStatusBarItem(alignment, priority);
    }
    public showWorkspaceFolderPick(options?: WorkspaceFolderPickOptions): Thenable<WorkspaceFolder | undefined> {
        return window.showWorkspaceFolderPick(options);
    }

}
