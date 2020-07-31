// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-invalid-this no-require-imports no-var-requires no-any max-classes-per-file

import { EventEmitter as NodeEventEmitter } from 'events';
import * as vscode from 'vscode';
// export * from './range';
// export * from './position';
// export * from './selection';
export * from './extHostedTypes';
export * from './uri';

export namespace vscMock {
    export enum ExtensionKind {
        /**
         * Extension runs where the UI runs.
         */
        UI = 1,

        /**
         * Extension runs where the remote extension host runs.
         */
        Workspace = 2
    }

    export class Disposable {
        constructor(private callOnDispose: Function) {}
        public dispose(): any {
            if (this.callOnDispose) {
                this.callOnDispose();
            }
        }
    }

    export class EventEmitter<T> implements vscode.EventEmitter<T> {
        public event: vscode.Event<T>;
        public emitter: NodeEventEmitter;
        constructor() {
            // @ts-ignore
            this.event = this.add.bind(this);
            this.emitter = new NodeEventEmitter();
        }
        public fire(data?: T): void {
            this.emitter.emit('evt', data);
        }
        public dispose(): void {
            this.emitter.removeAllListeners();
        }

        protected add = (listener: (e: T) => any, _thisArgs?: any, _disposables?: Disposable[]): Disposable => {
            const bound = _thisArgs ? listener.bind(_thisArgs) : listener;
            this.emitter.addListener('evt', bound);
            return ({
                dispose: () => {
                    this.emitter.removeListener('evt', bound);
                }
            } as any) as Disposable;
        };
    }

    export class CancellationToken extends EventEmitter<any> implements vscode.CancellationToken {
        public isCancellationRequested!: boolean;
        public onCancellationRequested: vscode.Event<any>;
        constructor() {
            super();
            // @ts-ignore
            this.onCancellationRequested = this.add.bind(this);
        }
        public cancel() {
            this.isCancellationRequested = true;
            this.fire();
        }
    }

    export class CancellationTokenSource {
        public token: CancellationToken;
        constructor() {
            this.token = new CancellationToken();
        }
        public cancel(): void {
            this.token.cancel();
        }
        public dispose(): void {
            this.token.dispose();
        }
    }

    export class CodeAction {
        public title: string;
        public edit?: vscode.WorkspaceEdit;
        public diagnostics?: vscode.Diagnostic[];
        public command?: vscode.Command;
        public kind?: CodeActionKind;
        public isPreferred?: boolean;
        constructor(_title: string, _kind?: CodeActionKind) {
            this.title = _title;
            this.kind = _kind;
        }
    }

    export enum CompletionItemKind {
        Text = 0,
        Method = 1,
        Function = 2,
        Constructor = 3,
        Field = 4,
        Variable = 5,
        Class = 6,
        Interface = 7,
        Module = 8,
        Property = 9,
        Unit = 10,
        Value = 11,
        Enum = 12,
        Keyword = 13,
        Snippet = 14,
        Color = 15,
        Reference = 17,
        File = 16,
        Folder = 18,
        EnumMember = 19,
        Constant = 20,
        Struct = 21,
        Event = 22,
        Operator = 23,
        TypeParameter = 24,
        User = 25,
        Issue = 26
    }
    export enum SymbolKind {
        File = 0,
        Module = 1,
        Namespace = 2,
        Package = 3,
        Class = 4,
        Method = 5,
        Property = 6,
        Field = 7,
        Constructor = 8,
        Enum = 9,
        Interface = 10,
        Function = 11,
        Variable = 12,
        Constant = 13,
        String = 14,
        Number = 15,
        Boolean = 16,
        Array = 17,
        Object = 18,
        Key = 19,
        Null = 20,
        EnumMember = 21,
        Struct = 22,
        Event = 23,
        Operator = 24,
        TypeParameter = 25
    }
    export enum IndentAction {
        None = 0,
        Indent = 1,
        IndentOutdent = 2,
        Outdent = 3
    }

    export class CodeActionKind {
        public static readonly Empty: CodeActionKind = new CodeActionKind('empty');
        public static readonly QuickFix: CodeActionKind = new CodeActionKind('quick.fix');

        public static readonly Refactor: CodeActionKind = new CodeActionKind('refactor');

        public static readonly RefactorExtract: CodeActionKind = new CodeActionKind('refactor.extract');

        public static readonly RefactorInline: CodeActionKind = new CodeActionKind('refactor.inline');

        public static readonly RefactorRewrite: CodeActionKind = new CodeActionKind('refactor.rewrite');
        public static readonly Source: CodeActionKind = new CodeActionKind('source');
        public static readonly SourceOrganizeImports: CodeActionKind = new CodeActionKind('source.organize.imports');
        public static readonly SourceFixAll: CodeActionKind = new CodeActionKind('source.fix.all');

        private constructor(private _value: string) {}

        public append(parts: string): CodeActionKind {
            return new CodeActionKind(`${this._value}.${parts}`);
        }
        public intersects(other: CodeActionKind): boolean {
            return this._value.includes(other._value) || other._value.includes(this._value);
        }

        public contains(other: CodeActionKind): boolean {
            return this._value.startsWith(other._value);
        }

        public get value(): string {
            return this._value;
        }
    }

    // tslint:disable-next-line: interface-name
    export interface DebugAdapterExecutableOptions {
        env?: { [key: string]: string };
        cwd?: string;
    }

    export class DebugAdapterServer {
        constructor(public readonly port: number, public readonly host?: string) {}
    }
    export class DebugAdapterExecutable {
        constructor(
            public readonly command: string,
            public readonly args: string[] = [],
            public readonly options?: DebugAdapterExecutableOptions
        ) {}
    }

    export enum FileType {
        Unknown = 0,
        File = 1,
        Directory = 2,
        SymbolicLink = 64
    }
}
