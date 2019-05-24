// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import {
    CancellationToken,
    DiagnosticCollection,
    Disposable,
    Event,
    OutputChannel,
    TextDocumentContentChangeEvent
} from 'vscode';
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
    Protocol2CodeConverter,
    RequestHandler,
    RequestHandler0,
    RequestType,
    RequestType0,
    RPCMessageType,
    StateChangeEvent,
    StaticFeature,
    TextDocumentItem,
    Trace,
    VersionedTextDocumentIdentifier
} from 'vscode-languageclient';

import { createDeferred, Deferred } from '../../client/common/utils/async';
import { noop } from '../core';
import { MockProtocolConverter } from './mockProtocolConverter';

// tslint:disable:no-any unified-signatures
export class MockLanguageClient extends LanguageClient {
    private notificationPromise : Deferred<void> | undefined;
    private contents : string = '';
    private versionId: number | null = 0;
    private converter: MockProtocolConverter = new MockProtocolConverter();

    public waitForNotification() : Promise<void> {
        this.notificationPromise = createDeferred();
        return this.notificationPromise.promise;
    }

    // Returns the current contents of the document being built by the completion provider calls
    public getDocumentContents() : string {
        return this.contents;
    }

    public getVersionId() : number | null {
        return this.versionId;
    }

    public stop(): Thenable<void> {
        throw new Error('Method not implemented.');
    }
    public registerProposedFeatures(): void {
        throw new Error('Method not implemented.');
    }
    public get initializeResult(): InitializeResult | undefined {
        throw new Error('Method not implemented.');
    }
    public sendRequest<R, E, RO>(type: RequestType0<R, E, RO>, token?: CancellationToken | undefined): Thenable<R>;
    public sendRequest<P, R, E, RO>(type: RequestType<P, R, E, RO>, params: P, token?: CancellationToken | undefined): Thenable<R>;
    public sendRequest<R>(method: string, token?: CancellationToken | undefined): Thenable<R>;
    public sendRequest<R>(method: string, param: any, token?: CancellationToken | undefined): Thenable<R>;
    public sendRequest(_method: any, _param?: any, _token?: any) : Thenable<any> {
        switch (_method.method) {
            case 'textDocument/completion':
                // Just return one for each line of our contents
                return Promise.resolve(this.getDocumentCompletions());
                break;

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
        throw new Error('Method not implemented.');
    }
    public get code2ProtocolConverter(): Code2ProtocolConverter {
        return this.converter;
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
    protected createMessageTransports(_encoding: string): Thenable<MessageTransports> {
        throw new Error('Method not implemented.');
    }
    protected registerBuiltinFeatures(): void {
        noop();
    }

    private applyChanges(changes: TextDocumentContentChangeEvent[]) {
        changes.forEach(c => {
            const before = this.contents.substr(0, c.rangeOffset);
            const after = this.contents.substr(c.rangeOffset + c.rangeLength);
            this.contents = `${before}${c.text}${after}`;
        });
    }

    private getDocumentCompletions() : CompletionItem[] {
        const lines = this.contents.splitLines();
        return lines.map(l => {
            return {
                label: l,
                insertText: l,
                sortText: l
            };
        });
    }
}
