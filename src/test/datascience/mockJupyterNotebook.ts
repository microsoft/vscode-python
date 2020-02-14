// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { JSONObject } from '@phosphor/coreutils/lib/json';
import { Observable } from 'rxjs/Observable';
import { CancellationToken, Event, EventEmitter, Uri } from 'vscode';
import { Resource } from '../../client/common/types';
import { Identifiers } from '../../client/datascience/constants';
import { LiveKernelModel } from '../../client/datascience/jupyter/kernels/types';
import {
    ICell,
    IJupyterKernelSpec,
    INotebook,
    INotebookCompletion,
    INotebookExecutionLogger,
    INotebookServer,
    InterruptResult
} from '../../client/datascience/types';
import { PythonInterpreter } from '../../client/interpreter/contracts';
import { ServerStatus } from '../../datascience-ui/interactive-common/mainState';
import { noop } from '../core';

export class MockJupyterNotebook implements INotebook {
    public onKernelChanged: Event<IJupyterKernelSpec | LiveKernelModel> = new EventEmitter<
        IJupyterKernelSpec | LiveKernelModel
    >().event;
    private onStatusChangedEvent: EventEmitter<ServerStatus> | undefined;
    constructor(private owner: INotebookServer) {
        noop();
    }

    public get server(): INotebookServer {
        return this.owner;
    }

    public get identity(): Uri {
        return Uri.parse(Identifiers.InteractiveWindowIdentity);
    }

    public get resource(): Resource {
        return Uri.file('foo.py');
    }

    public clear(_id: string): void {
        noop();
    }
    public executeObservable(_code: string, _f: string, _line: number): Observable<ICell[]> {
        throw new Error('Method not implemented');
    }

    public inspect(_code: string, _cancelToken?: CancellationToken): Promise<JSONObject> {
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

    public getMatchingInterpreter(): PythonInterpreter | undefined {
        return;
    }

    public setInterpreter(_inter: PythonInterpreter) {
        noop();
    }

    public getKernelSpec(): IJupyterKernelSpec | undefined {
        return;
    }

    public setKernelSpec(_spec: IJupyterKernelSpec | LiveKernelModel, _timeout: number): Promise<void> {
        return Promise.resolve();
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
}
