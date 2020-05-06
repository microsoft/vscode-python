// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { CancellationToken, DiagnosticCollection, Disposable, Event, Hover, OutputChannel } from 'vscode';
import {
    Code2ProtocolConverter,
    CompletionItem,
    DynamicFeature,
    ErrorHandler,
    GenericNotificationHandler,
    GenericRequestHandler,
    InitializeResult,
    LanguageClient,
    LanguageClientOptions,
    MessageTransports,
    NotificationHandler,
    NotificationHandler0,
    NotificationType,
    NotificationType0,
    Position,
    Protocol2CodeConverter,
    Range,
    RequestHandler,
    RequestHandler0,
    RequestType,
    RequestType0,
    RPCMessageType,
    ServerOptions,
    StateChangeEvent,
    StaticFeature,
    TextDocumentContentChangeEvent,
    TextDocumentItem,
    TextDocumentSyncKind,
    Trace,
    VersionedTextDocumentIdentifier
} from 'vscode-languageclient';

import { LanguageServerType } from '../../client/activation/types';
import { createDeferred, Deferred } from '../../client/common/utils/async';
import { IntellisenseLine } from '../../client/datascience/interactive-common/intellisense/intellisenseLine';
import { noop } from '../core';
import { MockCode2ProtocolConverter } from './mockCode2ProtocolConverter';
import { MockProtocol2CodeConverter } from './mockProtocol2CodeConverter';

// tslint:disable:no-any unified-signatures
export class MockLanguageClient extends LanguageClient {
    private notificationPromise: Deferred<void> | undefined;
    private contents: string;
    private versionId: number | null;
    private code2Protocol: MockCode2ProtocolConverter;
    private protocol2Code: MockProtocol2CodeConverter;
    private initResult: InitializeResult;

    public constructor(
        name: string,
        serverOptions: ServerOptions,
        clientOptions: LanguageClientOptions,
        forceDebug?: boolean
    ) {
        (LanguageClient.prototype as any).checkVersion = noop;
        super(name, serverOptions, clientOptions, forceDebug);
        this.contents = '';
        this.versionId = 0;
        this.code2Protocol = new MockCode2ProtocolConverter();
        this.protocol2Code = new MockProtocol2CodeConverter();

        // Vary our initialize result based on the name
        if (name === LanguageServerType.Microsoft) {
            this.initResult = {
                capabilities: {
                    textDocumentSync: TextDocumentSyncKind.Incremental
                }
            };
        } else {
            this.initResult = {
                capabilities: {
                    textDocumentSync: TextDocumentSyncKind.Full
                }
            };
        }
    }
    public waitForNotification(): Promise<void> {
        this.notificationPromise = createDeferred();
        return this.notificationPromise.promise;
    }

    // Returns the current contents of the document being built by the completion provider calls
    public getDocumentContents(): string {
        return this.contents;
    }

    public getVersionId(): number | null {
        return this.versionId;
    }

    public stop(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public registerProposedFeatures(): void {
        throw new Error('Method not implemented.');
    }
    public get initializeResult(): InitializeResult | undefined {
        return this.initResult;
    }
    public sendRequest<R, E, RO>(type: RequestType0<R, E, RO>, token?: CancellationToken): Promise<R>;
    public sendRequest<P, R, E, RO>(type: RequestType<P, R, E, RO>, params: P, token?: CancellationToken): Promise<R>;
    public sendRequest<R>(method: string, token?: CancellationToken): Promise<R>;
    public sendRequest<R>(method: string, param: any, token?: CancellationToken): Promise<R>;
    public sendRequest(_method: any, _param?: any, _token?: any): Promise<any> {
        switch (_method.method) {
            case 'textDocument/completion':
                // Just return one for each line of our contents
                return Promise.resolve(this.getDocumentCompletions());

            case 'textDocument/hover':
                // Just return a simple hover
                return Promise.resolve(this.getHover());
            default:
                break;
        }
        return Promise.resolve();
    }
    public onRequest<R, E, RO>(type: RequestType0<R, E, RO>, handler: RequestHandler0<R, E>): void;
    public onRequest<P, R, E, RO>(type: RequestType<P, R, E, RO>, handler: RequestHandler<P, R, E>): void;
    public onRequest<R, E>(method: string, handler: GenericRequestHandler<R, E>): void;
    public onRequest(_method: any, _handler: any) {
        throw new Error('Method not implemented.');
    }
    public sendNotification<RO>(type: NotificationType0<RO>): void;
    public sendNotification<P, RO>(type: NotificationType<P, RO>, params?: P | undefined): void;
    public sendNotification(method: string): void;
    public sendNotification(method: string, params: any): void;
    public sendNotification(method: any, params?: any) {
        switch (method.method) {
            case 'textDocument/didOpen':
                const item = params.textDocument as TextDocumentItem;
                if (item) {
                    this.contents = item.text;
                    this.versionId = item.version;
                }
                break;

            case 'textDocument/didChange':
                const id = params.textDocument as VersionedTextDocumentIdentifier;
                const changes = params.contentChanges as TextDocumentContentChangeEvent[];
                if (id && changes) {
                    this.applyChanges(changes);
                    this.versionId = id.version;
                }
                break;

            default:
                if (this.notificationPromise) {
                    this.notificationPromise.reject(new Error(`Unknown notification ${method.method}`));
                }
                break;
        }
        if (this.notificationPromise && !this.notificationPromise.resolved) {
            this.notificationPromise.resolve();
        }
    }
    public onNotification<RO>(type: NotificationType0<RO>, handler: NotificationHandler0): void;
    public onNotification<P, RO>(type: NotificationType<P, RO>, handler: NotificationHandler<P>): void;
    public onNotification(method: string, handler: GenericNotificationHandler): void;
    public onNotification(_method: any, _handler: any) {
        throw new Error('Method not implemented.');
    }
    public get clientOptions(): LanguageClientOptions {
        throw new Error('Method not implemented.');
    }
    public get protocol2CodeConverter(): Protocol2CodeConverter {
        return this.protocol2Code;
    }
    public get code2ProtocolConverter(): Code2ProtocolConverter {
        return this.code2Protocol;
    }
    public get onTelemetry(): Event<any> {
        throw new Error('Method not implemented.');
    }
    public get onDidChangeState(): Event<StateChangeEvent> {
        throw new Error('Method not implemented.');
    }
    public get outputChannel(): OutputChannel {
        throw new Error('Method not implemented.');
    }
    public get diagnostics(): DiagnosticCollection | undefined {
        throw new Error('Method not implemented.');
    }
    public createDefaultErrorHandler(): ErrorHandler {
        throw new Error('Method not implemented.');
    }
    public get trace(): Trace {
        throw new Error('Method not implemented.');
    }
    public info(_message: string, _data?: any): void {
        throw new Error('Method not implemented.');
    }
    public warn(_message: string, _data?: any): void {
        throw new Error('Method not implemented.');
    }
    public error(_message: string, _data?: any): void {
        throw new Error('Method not implemented.');
    }
    public needsStart(): boolean {
        throw new Error('Method not implemented.');
    }
    public needsStop(): boolean {
        throw new Error('Method not implemented.');
    }
    public onReady(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public start(): Disposable {
        throw new Error('Method not implemented.');
    }
    public registerFeatures(_features: (StaticFeature | DynamicFeature<any>)[]): void {
        throw new Error('Method not implemented.');
    }
    public registerFeature(_feature: StaticFeature | DynamicFeature<any>): void {
        throw new Error('Method not implemented.');
    }
    public logFailedRequest(_type: RPCMessageType, _error: any): void {
        throw new Error('Method not implemented.');
    }

    protected handleConnectionClosed(): void {
        throw new Error('Method not implemented.');
    }
    protected createMessageTransports(_encoding: string): Promise<MessageTransports> {
        throw new Error('Method not implemented.');
    }
    protected registerBuiltinFeatures(): void {
        noop();
    }

    private applyChanges(changes: TextDocumentContentChangeEvent[]) {
        if (this.initResult.capabilities.textDocumentSync === TextDocumentSyncKind.Incremental) {
            changes.forEach((change: TextDocumentContentChangeEvent) => {
                const c = change as { range: Range; rangeLength?: number; text: string };
                if (c.range) {
                    const offset = c.range ? this.getOffset(c.range.start) : 0;
                    const before = this.contents.substr(0, offset);
                    const after = c.rangeLength ? this.contents.substr(offset + c.rangeLength) : '';
                    this.contents = `${before}${c.text}${after}`;
                }
            });
        } else {
            changes.forEach((c: TextDocumentContentChangeEvent) => {
                this.contents = c.text;
            });
        }
    }

    private getDocumentCompletions(): CompletionItem[] {
        const lines = this.contents.splitLines();
        return lines.map((l) => {
            return {
                label: l,
                insertText: l,
                sortText: l
            };
        });
    }

    private getHover(): Hover {
        return {
            contents: [this.contents]
        };
    }

    private createLines(): IntellisenseLine[] {
        const split = this.contents.splitLines({ trim: false, removeEmptyEntries: false });
        let prevLine: IntellisenseLine | undefined;
        return split.map((s, i) => {
            const nextLine = this.createTextLine(s, i, prevLine);
            prevLine = nextLine;
            return nextLine;
        });
    }

    private createTextLine(line: string, index: number, prevLine: IntellisenseLine | undefined): IntellisenseLine {
        return new IntellisenseLine(
            line,
            index,
            prevLine ? prevLine.offset + prevLine.rangeIncludingLineBreak.end.character : 0
        );
    }

    private getOffset(position: Position): number {
        const lines = this.createLines();
        if (position.line >= 0 && position.line < lines.length) {
            return lines[position.line].offset + position.character;
        }
        return 0;
    }
}
