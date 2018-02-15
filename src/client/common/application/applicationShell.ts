// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

// tslint:disable:no-require-imports no-var-requires no-any unified-signatures
const opn = require('opn');

import { injectable } from 'inversify';
import * as vscode from 'vscode';
import { Disposable, StatusBarAlignment, StatusBarItem, WorkspaceFolder, WorkspaceFolderPickOptions } from 'vscode';
import { IApplicationShell } from './types';

@injectable()
export class ApplicationShell implements IApplicationShell {
    public showInformationMessage(message: string, ...items: string[]): Thenable<string>;
    public showInformationMessage(message: string, options: vscode.MessageOptions, ...items: string[]): Thenable<string>;
    public showInformationMessage<T extends vscode.MessageItem>(message: string, ...items: T[]): Thenable<T>;
    public showInformationMessage<T extends vscode.MessageItem>(message: string, options: vscode.MessageOptions, ...items: T[]): Thenable<T>;
    public showInformationMessage(message: string, options?: any, ...items: any[]): Thenable<any> {
        return vscode.window.showInformationMessage(message, options, ...items);
    }

    public showWarningMessage(message: string, ...items: string[]): Thenable<string>;
    public showWarningMessage(message: string, options: vscode.MessageOptions, ...items: string[]): Thenable<string>;
    public showWarningMessage<T extends vscode.MessageItem>(message: string, ...items: T[]): Thenable<T>;
    public showWarningMessage<T extends vscode.MessageItem>(message: string, options: vscode.MessageOptions, ...items: T[]): Thenable<T>;
    public showWarningMessage(message: any, options?: any, ...items: any[]) {
        return vscode.window.showWarningMessage(message, options, ...items);
    }

    public showErrorMessage(message: string, ...items: string[]): Thenable<string>;
    public showErrorMessage(message: string, options: vscode.MessageOptions, ...items: string[]): Thenable<string>;
    public showErrorMessage<T extends vscode.MessageItem>(message: string, ...items: T[]): Thenable<T>;
    public showErrorMessage<T extends vscode.MessageItem>(message: string, options: vscode.MessageOptions, ...items: T[]): Thenable<T>;
    public showErrorMessage(message: any, options?: any, ...items: any[]) {
        return vscode.window.showErrorMessage(message, options, ...items);
    }

    public showQuickPick(items: string[] | Thenable<string[]>, options?: vscode.QuickPickOptions, token?: vscode.CancellationToken): Thenable<string>;
    public showQuickPick<T extends vscode.QuickPickItem>(items: T[] | Thenable<T[]>, options?: vscode.QuickPickOptions, token?: vscode.CancellationToken): Thenable<T>;
    public showQuickPick(items: any, options?: any, token?: any) {
        return vscode.window.showQuickPick(items, options, token);
    }

    public showOpenDialog(options: vscode.OpenDialogOptions): Thenable<vscode.Uri[] | undefined> {
        return vscode.window.showOpenDialog(options);
    }
    public showSaveDialog(options: vscode.SaveDialogOptions): Thenable<vscode.Uri | undefined> {
        return vscode.window.showSaveDialog(options);
    }
    public showInputBox(options?: vscode.InputBoxOptions, token?: vscode.CancellationToken): Thenable<string | undefined> {
        return vscode.window.showInputBox(options, token);
    }
    public openUrl(url: string): void {
        opn(url);
    }

    public setStatusBarMessage(text: string, hideAfterTimeout: number): Disposable;
    public setStatusBarMessage(text: string, hideWhenDone: Thenable<any>): Disposable;
    public setStatusBarMessage(text: string): Disposable;
    public setStatusBarMessage(text: string, arg?: any): Disposable {
        return vscode.window.setStatusBarMessage(text, arg);
    }

    public createStatusBarItem(alignment?: StatusBarAlignment, priority?: number): StatusBarItem {
        return vscode.window.createStatusBarItem(alignment, priority);
    }
    public showWorkspaceFolderPick(options?: WorkspaceFolderPickOptions): Thenable<WorkspaceFolder | undefined> {
        return vscode.window.showWorkspaceFolderPick(options);
    }

}
