// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { expect } from 'chai';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import * as TypeMoq from 'typemoq';
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

import { ILanguageServer, ILanguageServerAnalysisOptions } from '../../client/activation/types';
import { IWorkspaceService } from '../../client/common/application/types';
import { PythonSettings } from '../../client/common/configSettings';
import { IFileSystem } from '../../client/common/platform/types';
import { IConfigurationService } from '../../client/common/types';
import { createDeferred, Deferred } from '../../client/common/utils/async';
import { Identifiers } from '../../client/datascience/constants';
import { HistoryMessages, IHistoryMapping } from '../../client/datascience/history/historyTypes';
import { DotNetIntellisenseProvider } from '../../client/datascience/history/intellisense/dotNetIntellisenseProvider';
import { IHistoryListener } from '../../client/datascience/types';
import { noop } from '../core';
import { MockAutoSelectionService } from '../mocks/autoSelector';

// tslint:disable:no-any unified-signatures

class MockLanguageClient extends LanguageClient {
    private notificationPromise : Deferred<void> | undefined;
    private contents : string = '';
    private versionId: number | null = 0;

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

    private applyChanges(changes: TextDocumentContentChangeEvent[]) {
        changes.forEach(c => {
            const before = this.contents.substr(0, c.rangeOffset);
            const after = this.contents.substr(c.rangeOffset + c.rangeLength);
            this.contents = `${before}${c.text}${after}`;
        });
    }
}

// tslint:disable-next-line: max-func-body-length
suite('DataScience Intellisense Unit Tests', () => {
    let intellisenseProvider: IHistoryListener;
    let languageServer: TypeMoq.IMock<ILanguageServer>;
    let analysisOptions: TypeMoq.IMock<ILanguageServerAnalysisOptions>;
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    let configService: TypeMoq.IMock<IConfigurationService>;
    let fileSystem: TypeMoq.IMock<IFileSystem>;
    const pythonSettings = new class extends PythonSettings {
        public fireChangeEvent() {
            this.changed.fire();
        }
    }(undefined, new MockAutoSelectionService());

    const languageClient = new MockLanguageClient(
        'mockLanguageClient', { module: 'dummy' }, {});

    setup(() => {
        languageServer = TypeMoq.Mock.ofType<ILanguageServer>();
        analysisOptions = TypeMoq.Mock.ofType<ILanguageServerAnalysisOptions>();
        workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        configService = TypeMoq.Mock.ofType<IConfigurationService>();
        fileSystem = TypeMoq.Mock.ofType<IFileSystem>();

        pythonSettings.jediEnabled = false;
        languageServer.setup(l => l.start(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve());
        analysisOptions.setup(a => a.getAnalysisOptions()).returns(() => Promise.resolve({}));
        languageServer.setup(l => l.languageClient).returns(() => languageClient);
        configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings);

        intellisenseProvider = new DotNetIntellisenseProvider(languageServer.object, analysisOptions.object, workspaceService.object, configService.object, fileSystem.object);
    });

    function sendMessage<M extends IHistoryMapping, T extends keyof M>(type: T, payload?: M[T]) : Promise<void> {
        const result = languageClient.waitForNotification();
        intellisenseProvider.onMessage(type.toString(), payload);
        return result;
    }

    function addCell(code: string, id: string) : Promise<void> {
        return sendMessage(HistoryMessages.AddCell, { text: code, file: 'foo.py', id });
    }

    function updateCell(newCode: string, oldCode: string, id: string) : Promise<void> {
        const oldSplit = oldCode.split('\n');
        const change: monacoEditor.editor.IModelContentChange = {
            range: {
                startLineNumber: 1,
                startColumn: 1,
                endLineNumber: oldSplit.length,
                endColumn: oldSplit[oldSplit.length - 1].length + 1
            },
            rangeOffset: 0,
            rangeLength: oldCode.length,
            text: newCode
        };
        return sendMessage(HistoryMessages.EditCell, { changes: [change], id});
    }

    function addCode(code: string, line: number, pos: number, offset: number) : Promise<void> {
        if (!line || !pos) {
            throw new Error('Invalid line or position data');
        }
        const change: monacoEditor.editor.IModelContentChange = {
            range: {
                startLineNumber: line,
                startColumn: pos,
                endLineNumber: line,
                endColumn: pos
            },
            rangeOffset: offset,
            rangeLength: 0,
            text: code
        };
        return sendMessage(HistoryMessages.EditCell, { changes: [change], id: Identifiers.EditCellId});
    }

    function removeCode(line: number, startPos: number, endPos: number, length: number) : Promise<void> {
        if (!line || !startPos || !endPos) {
            throw new Error('Invalid line or position data');
        }
        const change: monacoEditor.editor.IModelContentChange = {
            range: {
                startLineNumber: line,
                startColumn: startPos,
                endLineNumber: line,
                endColumn: endPos
            },
            rangeOffset: startPos,
            rangeLength: length,
            text: ''
        };
        return sendMessage(HistoryMessages.EditCell, { changes: [change], id: Identifiers.EditCellId});
    }

    test('Add a single cell', async () => {
        await addCell('import sys\n\n', '1');
        expect(languageClient.getDocumentContents()).to.be.eq('import sys\n\n\n', 'Document not set');
    });

    test('Add two cells', async () => {
        await addCell('import sys', '1');
        expect(languageClient.getDocumentContents()).to.be.eq('import sys\n', 'Document not set');
        await addCell('import sys', '2');
        expect(languageClient.getDocumentContents()).to.be.eq('import sys\nimport sys\n', 'Document not set after double');
    });

    test('Add a cell and edit', async () => {
        await addCell('import sys', '1');
        expect(languageClient.getDocumentContents()).to.be.eq('import sys\n', 'Document not set');
        await addCode('i', 1, 1, 0);
        expect(languageClient.getDocumentContents()).to.be.eq('import sys\ni', 'Document not set after edit');
        await addCode('m', 1, 2, 1);
        expect(languageClient.getDocumentContents()).to.be.eq('import sys\nim', 'Document not set after edit');
        await addCode('\n', 1, 3, 2);
        expect(languageClient.getDocumentContents()).to.be.eq('import sys\nim\n', 'Document not set after edit');
    });

    test('Add a cell and remove', async () => {
        await addCell('import sys', '1');
        expect(languageClient.getDocumentContents()).to.be.eq('import sys\n', 'Document not set');
        await addCode('i', 1, 1, 0);
        expect(languageClient.getDocumentContents()).to.be.eq('import sys\ni', 'Document not set after edit');
        await removeCode(1, 1, 2, 1);
        expect(languageClient.getDocumentContents()).to.be.eq('import sys\n', 'Document not set after edit');
        await addCode('\n', 1, 1, 0);
        expect(languageClient.getDocumentContents()).to.be.eq('import sys\n\n', 'Document not set after edit');
    });

    test('Remove a section in the middle', async () => {
        await addCell('import sys', '1');
        expect(languageClient.getDocumentContents()).to.be.eq('import sys\n', 'Document not set');
        await addCode('import os', 1, 1, 0);
        expect(languageClient.getDocumentContents()).to.be.eq('import sys\nimport os', 'Document not set after edit');
        await removeCode(1, 4, 7, 4);
        expect(languageClient.getDocumentContents()).to.be.eq('import sys\nimp os', 'Document not set after edit');
    });

    test('Remove a bunch in a row', async () => {
        await addCell('import sys', '1');
        expect(languageClient.getDocumentContents()).to.be.eq('import sys\n', 'Document not set');
        await addCode('p', 1, 1, 0);
        await addCode('r', 1, 2, 1);
        await addCode('i', 1, 3, 2);
        await addCode('n', 1, 4, 3);
        await addCode('t', 1, 5, 4);
        expect(languageClient.getDocumentContents()).to.be.eq('import sys\nprint', 'Document not set after edit');
        await removeCode(1, 5, 6, 1);
        await removeCode(1, 4, 5, 1);
        await removeCode(1, 3, 4, 1);
        await removeCode(1, 2, 3, 1);
        await removeCode(1, 1, 2, 1);
        expect(languageClient.getDocumentContents()).to.be.eq('import sys\n', 'Document not set after edit');
    });
    test('Remove from a line', async () => {
        await addCell('import sys', '1');
        expect(languageClient.getDocumentContents()).to.be.eq('import sys\n', 'Document not set');
        await addCode('s', 1, 1, 0);
        await addCode('y', 1, 2, 1);
        await addCode('s', 1, 3, 2);
        expect(languageClient.getDocumentContents()).to.be.eq('import sys\nsys', 'Document not set after edit');
        await addCode('\n', 1, 4, 3);
        expect(languageClient.getDocumentContents()).to.be.eq('import sys\nsys\n', 'Document not set after edit');
        await addCode('s', 2, 1, 3);
        await addCode('y', 2, 2, 4);
        await addCode('s', 2, 3, 5);
        expect(languageClient.getDocumentContents()).to.be.eq('import sys\nsys\nsys', 'Document not set after edit');
        await removeCode(1, 3, 4, 1);
        expect(languageClient.getDocumentContents()).to.be.eq('import sys\nsy\nsys', 'Document not set after edit');
    });

    test('Add cell after adding code', async () => {
        await addCell('import sys', '1');
        expect(languageClient.getDocumentContents()).to.be.eq('import sys\n', 'Document not set');
        await addCode('s', 1, 1, 0);
        await addCode('y', 1, 2, 1);
        await addCode('s', 1, 3, 2);
        expect(languageClient.getDocumentContents()).to.be.eq('import sys\nsys', 'Document not set after edit');
        await addCell('import sys', '2');
        expect(languageClient.getDocumentContents()).to.be.eq('import sys\nimport sys\nsys', 'Adding a second cell broken');
    });

    test('Collapse expand cell', async () => {
        await addCell('import sys', '1');
        expect(languageClient.getDocumentContents()).to.be.eq('import sys\n', 'Document not set');
        await updateCell('import sys\nsys.version_info', 'import sys', '1');
        expect(languageClient.getDocumentContents()).to.be.eq('import sys\nsys.version_info\n', 'Readding a cell broken');
        await updateCell('import sys', 'import sys\nsys.version_info', '1');
        expect(languageClient.getDocumentContents()).to.be.eq('import sys\n', 'Collapsing a cell broken');
    });

    test('Collapse expand cell after adding code', async () => {
        await addCell('import sys', '1');
        expect(languageClient.getDocumentContents()).to.be.eq('import sys\n', 'Document not set');
        await addCode('s', 1, 1, 0);
        await addCode('y', 1, 2, 1);
        await addCode('s', 1, 3, 2);
        expect(languageClient.getDocumentContents()).to.be.eq('import sys\nsys', 'Document not set after edit');
        await updateCell('import sys\nsys.version_info', 'import sys', '1');
        expect(languageClient.getDocumentContents()).to.be.eq('import sys\nsys.version_info\nsys', 'Readding a cell broken');
        await updateCell('import sys', 'import sys\nsys.version_info', '1');
        expect(languageClient.getDocumentContents()).to.be.eq('import sys\nsys', 'Collapsing a cell broken');
    });
});
