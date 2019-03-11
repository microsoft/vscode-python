// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { noop } from 'lodash';
import { Disposable, TextEditor, TextEditorEdit } from 'vscode';

import { ICommandManager } from '../../client/common/application/types';

// tslint:disable:no-any no-http-string no-multiline-string max-func-body-length

export class MockCommandManager implements ICommandManager {
    private commands: Map<string, (...args: any[]) => any> = new Map<string, (...args: any[]) => any>();

    public registerCommand(command: string, callback: (...args: any[]) => any, thisArg?: any): Disposable {
        this.commands.set(command, thisArg ? callback.bind(thisArg) : callback);
        return {
            dispose: () => {
                noop();
            }
        };
    }

    public registerTextEditorCommand(command: string, callback: (textEditor: TextEditor, edit: TextEditorEdit, ...args: any[]) => void, thisArg?: any): Disposable {
        throw new Error('Method not implemented.');
    }
    public executeCommand<T>(command: string, ...rest: any[]): Thenable<T | undefined> {
        const func = this.commands.get(command);
        if (func) {
            const result = func(...rest);
            const tPromise = result as Promise<T>;
            if (tPromise) {
                return tPromise;
            }
            return Promise.resolve(result);
        }
        return Promise.resolve(undefined);
    }

    public getCommands(filterInternal?: boolean): Thenable<string[]> {
        const keys = Object.keys(this.commands);
        return Promise.resolve(keys);
    }
}
