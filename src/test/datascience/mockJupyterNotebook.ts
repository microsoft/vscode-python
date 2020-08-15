// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Kernel, KernelMessage } from '@jupyterlab/services';
import { JSONObject } from '@phosphor/coreutils/lib/json';
import { Observable } from 'rxjs/Observable';
import { CancellationToken, Event, EventEmitter, Uri } from 'vscode';
import { Resource } from '../../client/common/types';
import { getDefaultInteractiveIdentity } from '../../client/datascience/interactive-window/identity';
import { KernelConnectionMetadata } from '../../client/datascience/jupyter/kernels/types';
import {
    ICell,
    ICellHashProvider,
    INotebook,
    INotebookCompletion,
    INotebookExecutionLogger,
    INotebookProviderConnection,
    InterruptResult,
    KernelSocketInformation
} from '../../client/datascience/types';
import { PythonEnvironment } from '../../client/pythonEnvironments/info';
import { ServerStatus } from '../../datascience-ui/interactive-common/mainState';
import { noop } from '../core';

export class MockJupyterNotebook implements INotebook {
    public get connection(): INotebookProviderConnection | undefined {
        return this.providerConnection;
    }
    public get identity(): Uri {
        return getDefaultInteractiveIdentity();
    }
    public get onSessionStatusChanged(): Event<ServerStatus> {
        if (!this.onStatusChangedEvent) {
            this.onStatusChangedEvent = new EventEmitter<ServerStatus>();
        }
        return this.onStatusChangedEvent.event;
    }

    public get status(): ServerStatus {
        return ServerStatus.Idle;
    }

    public get resource(): Resource {
        return Uri.file('foo.py');
    }
    public get onKernelInterrupted(): Event<void> {
        return this.kernelInterrupted.event;
    }
    public kernelSocket = new Observable<KernelSocketInformation | undefined>();
    public onKernelChanged = new EventEmitter<KernelConnectionMetadata>().event;
    public onDisposed = new EventEmitter<void>().event;
    public onKernelRestarted = new EventEmitter<void>().event;
    public readonly disposed: boolean = false;
    private kernelInterrupted = new EventEmitter<void>();
    private onStatusChangedEvent: EventEmitter<ServerStatus> | undefined;

    constructor(private providerConnection: INotebookProviderConnection | undefined) {
        noop();
    }
    public registerIOPubListener(_listener: (msg: KernelMessage.IIOPubMessage, requestId: string) => void): void {
        noop();
    }
    public getCellHashProvider(): ICellHashProvider | undefined {
        throw new Error('Method not implemented.');
    }

    public clear(_id: string): void {
        noop();
    }
    public executeObservable(_code: string, _f: string, _line: number): Observable<ICell[]> {
        throw new Error('Method not implemented');
    }

    public inspect(_code: string, _offsetInCode = 0, _cancelToken?: CancellationToken): Promise<JSONObject> {
        return Promise.resolve({});
    }

    public async getCompletion(
        _cellCode: string,
        _offsetInCode: number,
        _cancelToken?: CancellationToken
    ): Promise<INotebookCompletion> {
        throw new Error('Method not implemented');
    }
    public execute(_code: string, _f: string, _line: number): Promise<ICell[]> {
        throw new Error('Method not implemented');
    }
    public restartKernel(): Promise<void> {
        throw new Error('Method not implemented');
    }
    public translateToNotebook(_cells: ICell[]): Promise<JSONObject> {
        throw new Error('Method not implemented');
    }
    public waitForIdle(): Promise<void> {
        throw new Error('Method not implemented');
    }
    public setLaunchingFile(_file: string): Promise<void> {
        throw new Error('Method not implemented');
    }

    public async setMatplotLibStyle(_useDark: boolean): Promise<void> {
        noop();
    }

    public addLogger(_logger: INotebookExecutionLogger): void {
        noop();
    }

    public getSysInfo(): Promise<ICell | undefined> {
        return Promise.resolve(undefined);
    }

    public interruptKernel(_timeout: number): Promise<InterruptResult> {
        throw new Error('Method not implemented');
    }

    public async dispose(): Promise<void> {
        if (this.onStatusChangedEvent) {
            this.onStatusChangedEvent.dispose();
        }
        return Promise.resolve();
    }

    public getMatchingInterpreter(): PythonEnvironment | undefined {
        return;
    }

    public setInterpreter(_inter: PythonEnvironment) {
        noop();
    }

    public getKernelConnection(): KernelConnectionMetadata | undefined {
        return;
    }

    public setKernelConnection(_spec: KernelConnectionMetadata, _timeout: number): Promise<void> {
        return Promise.resolve();
    }

    public getLoggers(): INotebookExecutionLogger[] {
        return [];
    }

    public registerCommTarget(
        _targetName: string,
        _callback: (comm: Kernel.IComm, msg: KernelMessage.ICommOpenMsg) => void | PromiseLike<void>
    ) {
        noop();
    }

    public sendCommMessage(
        buffers: (ArrayBuffer | ArrayBufferView)[],
        content: { comm_id: string; data: JSONObject; target_name: string | undefined },
        // tslint:disable-next-line: no-any
        metadata: any,
        // tslint:disable-next-line: no-any
        msgId: any
    ): Kernel.IShellFuture<
        KernelMessage.IShellMessage<'comm_msg'>,
        KernelMessage.IShellMessage<KernelMessage.ShellMessageType>
    > {
        const shellMessage = KernelMessage.createMessage<KernelMessage.ICommMsgMsg<'shell'>>({
            // tslint:disable-next-line: no-any
            msgType: 'comm_msg',
            channel: 'shell',
            buffers,
            content,
            metadata,
            msgId,
            session: '1',
            username: '1'
        });

        return {
            done: Promise.resolve(undefined),
            msg: shellMessage,
            onReply: noop,
            onIOPub: noop,
            onStdin: noop,
            registerMessageHook: noop,
            removeMessageHook: noop,
            sendInputReply: noop,
            isDisposed: false,
            dispose: noop
        };
    }

    public requestCommInfo(
        _content: KernelMessage.ICommInfoRequestMsg['content']
    ): Promise<KernelMessage.ICommInfoReplyMsg> {
        const shellMessage = KernelMessage.createMessage<KernelMessage.ICommInfoReplyMsg>({
            msgType: 'comm_info_reply',
            channel: 'shell',
            content: {
                status: 'ok'
                // tslint:disable-next-line: no-any
            } as any,
            metadata: {},
            session: '1',
            username: '1'
        });

        return Promise.resolve(shellMessage);
    }
    public registerMessageHook(
        _msgId: string,
        _hook: (msg: KernelMessage.IIOPubMessage) => boolean | PromiseLike<boolean>
    ): void {
        noop();
    }
    public removeMessageHook(
        _msgId: string,
        _hook: (msg: KernelMessage.IIOPubMessage) => boolean | PromiseLike<boolean>
    ): void {
        noop();
    }
}
