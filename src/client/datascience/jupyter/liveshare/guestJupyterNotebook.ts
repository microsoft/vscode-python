// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Kernel, KernelMessage } from '@jupyterlab/services';
import { JSONObject } from '@phosphor/coreutils';
import { Observable } from 'rxjs/Observable';
import { Event, EventEmitter, Uri } from 'vscode';
import { CancellationToken } from 'vscode-jsonrpc';
import * as vsls from 'vsls/vscode';
import { ServerStatus } from '../../../../datascience-ui/interactive-common/mainState';
import { ILiveShareApi } from '../../../common/application/types';
import { CancellationError } from '../../../common/cancellation';
import { traceInfo } from '../../../common/logger';
import { IConfigurationService, IDisposableRegistry, Resource } from '../../../common/types';
import { createDeferred } from '../../../common/utils/async';
import * as localize from '../../../common/utils/localize';
import { noop } from '../../../common/utils/misc';
import { PythonInterpreter } from '../../../interpreter/contracts';
import { LiveShare, LiveShareCommands } from '../../constants';
import {
    ICell,
    IJupyterKernelSpec,
    INotebook,
    INotebookCompletion,
    INotebookExecutionLogger,
    INotebookServer,
    InterruptResult
} from '../../types';
import { LiveKernelModel } from '../kernels/types';
import { LiveShareParticipantDefault, LiveShareParticipantGuest } from './liveShareParticipantMixin';
import { ResponseQueue } from './responseQueue';
import { IExecuteObservableResponse, ILiveShareParticipant, IServerResponse } from './types';

export class GuestJupyterNotebook
    extends LiveShareParticipantGuest(LiveShareParticipantDefault, LiveShare.JupyterNotebookSharedService)
    implements INotebook, ILiveShareParticipant {
    private get jupyterLab(): undefined | typeof import('@jupyterlab/services') {
        if (!this._jupyterLab) {
            // tslint:disable-next-line:no-require-imports
            this._jupyterLab = require('@jupyterlab/services') as typeof import('@jupyterlab/services'); // NOSONAR
        }
        return this._jupyterLab;
    }

    public get identity(): Uri {
        return this._identity;
    }

    public get resource(): Resource {
        return this._resource;
    }

    public get server(): INotebookServer {
        return this._owner;
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

    public onKernelChanged: Event<IJupyterKernelSpec | LiveKernelModel> = new EventEmitter<
        IJupyterKernelSpec | LiveKernelModel
    >().event;
    public onKernelRestarted = new EventEmitter<void>().event;
    public onDisposed = new EventEmitter<void>().event;
    private _jupyterLab?: typeof import('@jupyterlab/services');
    private responseQueue: ResponseQueue = new ResponseQueue();
    private onStatusChangedEvent: EventEmitter<ServerStatus> | undefined;

    constructor(
        liveShare: ILiveShareApi,
        private disposableRegistry: IDisposableRegistry,
        private configService: IConfigurationService,
        private _resource: Resource,
        private _identity: Uri,
        private _owner: INotebookServer,
        private startTime: number
    ) {
        super(liveShare);
    }

    public shutdown(): Promise<void> {
        return Promise.resolve();
    }

    public dispose(): Promise<void> {
        if (this.onStatusChangedEvent) {
            this.onStatusChangedEvent.dispose();
        }
        return this.shutdown();
    }

    public waitForIdle(): Promise<void> {
        return Promise.resolve();
    }

    public clear(_id: string): void {
        // We don't do anything as we don't cache results in this class.
        noop();
    }

    public async execute(
        code: string,
        file: string,
        line: number,
        id: string,
        cancelToken?: CancellationToken
    ): Promise<ICell[]> {
        // Create a deferred that we'll fire when we're done
        const deferred = createDeferred<ICell[]>();

        // Attempt to evaluate this cell in the jupyter notebook
        const observable = this.executeObservable(code, file, line, id);
        let output: ICell[];

        observable.subscribe(
            (cells: ICell[]) => {
                output = cells;
            },
            error => {
                deferred.reject(error);
            },
            () => {
                deferred.resolve(output);
            }
        );

        if (cancelToken) {
            this.disposableRegistry.push(
                cancelToken.onCancellationRequested(() => deferred.reject(new CancellationError()))
            );
        }

        // Wait for the execution to finish
        return deferred.promise;
    }

    public async inspect(code: string): Promise<JSONObject> {
        // Send to the other side
        return this.sendRequest(LiveShareCommands.inspect, [code]);
    }

    public setLaunchingFile(_directory: string): Promise<void> {
        // Ignore this command on this side
        return Promise.resolve();
    }

    public async setMatplotLibStyle(_useDark: boolean): Promise<void> {
        // Guest can't change the style. Maybe output a warning here?
    }

    public executeObservable(code: string, file: string, line: number, id: string): Observable<ICell[]> {
        // Mimic this to the other side and then wait for a response
        this.waitForService()
            .then(s => {
                if (s) {
                    s.notify(LiveShareCommands.executeObservable, { code, file, line, id });
                }
            })
            .ignoreErrors();
        return this.responseQueue.waitForObservable(code, id);
    }

    public async restartKernel(): Promise<void> {
        // We need to force a restart on the host side
        return this.sendRequest(LiveShareCommands.restart, []);
    }

    public async interruptKernel(_timeoutMs: number): Promise<InterruptResult> {
        const settings = this.configService.getSettings(this.resource);
        const interruptTimeout = settings.datascience.jupyterInterruptTimeout;

        const response = await this.sendRequest(LiveShareCommands.interrupt, [interruptTimeout]);
        return response as InterruptResult;
    }

    public async waitForServiceName(): Promise<string> {
        // Use our base name plus our id. This means one unique server per notebook
        // Live share will not accept a '.' in the name so remove any
        const uriString = this.identity.toString();
        return Promise.resolve(`${LiveShare.JupyterNotebookSharedService}${uriString}`);
    }

    public async getSysInfo(): Promise<ICell | undefined> {
        // This is a special case. Ask the shared server
        const service = await this.waitForService();
        if (service) {
            const result = await service.request(LiveShareCommands.getSysInfo, []);
            return result as ICell;
        }
    }

    public async getCompletion(
        _cellCode: string,
        _offsetInCode: number,
        _cancelToken?: CancellationToken
    ): Promise<INotebookCompletion> {
        return Promise.resolve({
            matches: [],
            cursor: {
                start: 0,
                end: 0
            },
            metadata: {}
        });
    }

    public async onAttach(api: vsls.LiveShare | null): Promise<void> {
        await super.onAttach(api);

        if (api) {
            const service = await this.waitForService();

            // Wait for sync up
            const synced = service ? await service.request(LiveShareCommands.syncRequest, []) : undefined;
            if (!synced && api.session && api.session.role !== vsls.Role.None) {
                throw new Error(localize.DataScience.liveShareSyncFailure());
            }

            if (service) {
                // Listen to responses
                service.onNotify(LiveShareCommands.serverResponse, this.onServerResponse);

                // Request all of the responses since this guest was started. We likely missed a bunch
                service.notify(LiveShareCommands.catchupRequest, { since: this.startTime });
            }
        }
    }

    public getMatchingInterpreter(): PythonInterpreter | undefined {
        return;
    }

    public setInterpreter(_spec: PythonInterpreter) {
        noop();
    }

    public getKernelSpec(): IJupyterKernelSpec | LiveKernelModel | undefined {
        return;
    }

    public setKernelSpec(_spec: IJupyterKernelSpec | LiveKernelModel, _timeout: number): Promise<void> {
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
        const shellMessage = this.jupyterLab?.KernelMessage.createMessage<KernelMessage.ICommMsgMsg<'shell'>>({
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
            msg: shellMessage!, // NOSONAR
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

    public registerIOPubListener(
        _listener: (msg: KernelMessage.IIOPubMessage, requestId: string) => Promise<void>
    ): void {
        noop();
    }

    private onServerResponse = (args: Object) => {
        const er = args as IExecuteObservableResponse;
        traceInfo(`Guest serverResponse ${er.pos} ${er.id}`);
        // Args should be of type ServerResponse. Stick in our queue if so.
        if (args.hasOwnProperty('type')) {
            this.responseQueue.push(args as IServerResponse);
        }
    };

    // tslint:disable-next-line:no-any
    private async sendRequest(command: string, args: any[]): Promise<any> {
        const service = await this.waitForService();
        if (service) {
            return service.request(command, args);
        }
    }
}
