// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { CancellationToken, DiagnosticCollection, Disposable, Event, OutputChannel, TextDocument } from 'vscode';
import {
    Code2ProtocolConverter,
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
    Trace,
    TextDocumentItem
} from 'vscode-languageclient';

import { ILanguageServer, ILanguageServerAnalysisOptions } from '../../client/activation/types';
import { IWorkspaceService } from '../../client/common/application/types';
import { IFileSystem } from '../../client/common/platform/types';
import { createDeferred, Deferred } from '../../client/common/utils/async';
import { CompletionProvider } from '../../client/datascience/history/completionProvider';
import { HistoryMessages, IHistoryMapping } from '../../client/datascience/history/historyTypes';
import { IHistoryListener } from '../../client/datascience/types';
import { noop } from '../core';

// tslint:disable:no-any unified-signatures

class MockLanguageClient extends LanguageClient {
    private notificationPromise : Deferred<void> | undefined;
    private contents : string = '';

    public waitForNotification() : Promise<void> {
        this.notificationPromise = createDeferred();
        return this.notificationPromise.promise;
    }

    // Returns the current contents of the document being built by the completion provider calls
    public getDocumentContents() : string {
        return this.contents;
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
        throw new Error('Method not implemented.');
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
        throw new Error('Method not implemented.');
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
}

suite('DataScience CompletionProvider Unit Tests', () => {
    let completionProvider: IHistoryListener;
    let languageServer: TypeMoq.IMock<ILanguageServer>;
    let analysisOptions: TypeMoq.IMock<ILanguageServerAnalysisOptions>;
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    let fileSystem: TypeMoq.IMock<IFileSystem>;
    const languageClient = new MockLanguageClient(
        'mockLanguageClient', { module: 'dummy' }, {});

    setup(() => {
        languageServer = TypeMoq.Mock.ofType<ILanguageServer>();
        analysisOptions = TypeMoq.Mock.ofType<ILanguageServerAnalysisOptions>();
        workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        fileSystem = TypeMoq.Mock.ofType<IFileSystem>();

        languageServer.setup(l => l.start(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve());
        analysisOptions.setup(a => a.getAnalysisOptions()).returns(() => Promise.resolve({}));
        languageServer.setup(l => l.languageClient).returns(() => languageClient);

        completionProvider = new CompletionProvider(languageServer.object, analysisOptions.object, workspaceService.object, fileSystem.object);
    });

    function sendMessage<M extends IHistoryMapping, T extends keyof M>(type: T, payload?: M[T]) : Promise<void> {
        const result = languageClient.waitForNotification();
        completionProvider.onMessage(type.toString(), payload);
        return result;
    }

    function addCell(code: string) : Promise<void> {
        return sendMessage(HistoryMessages.RemoteAddCode, { code, file: 'foo.py', line: 0, id: '1', originator: '1'});
    }

    test('Add a single cell', async () => {
        await addCell('import sys');
        expect(languageClient.getDocumentContents()).to.be.eq('import sys', 'Document not set');
    });
});
