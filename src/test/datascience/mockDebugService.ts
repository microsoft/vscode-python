// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import * as net from 'net';
import * as uuid from 'uuid/v4';
import {
    Breakpoint,
    BreakpointsChangeEvent,
    DebugConfiguration,
    DebugConfigurationProvider,
    DebugConsole,
    DebugSession,
    DebugSessionCustomEvent,
    Disposable,
    Event,
    EventEmitter,
    WorkspaceFolder
} from 'vscode';

import { IDebugService } from '../../client/common/application/types';
import { IBufferDecoder } from '../../client/common/process/types';
import { createDeferred, Deferred } from '../../client/common/utils/async';
import { noop } from '../../client/common/utils/misc';

// For debugging set these environment variables
// PYDEV_DEBUG=True
// PTVSD_LOG_DIR=<dir that already exists>
// PYDEVD_DEBUG_FILE=<dir that exists, but new file allowed>

//tslint:disable:trailing-comma no-any no-multiline-string
@injectable()
export class MockDebuggerService implements IDebugService {
    private socket: net.Socket | undefined;
    private session: DebugSession | undefined;
    private sessionId: string | undefined;
    private sequence: number = 1;
    private breakStatePromise: Deferred<void> = createDeferred();
    private sessionChangedEvent: EventEmitter<DebugSession> = new EventEmitter<DebugSession>();
    private sessionStartedEvent: EventEmitter<DebugSession> = new EventEmitter<DebugSession>();
    private sessionTerminatedEvent: EventEmitter<DebugSession> = new EventEmitter<DebugSession>();
    private sessionCustomEvent: EventEmitter<DebugSessionCustomEvent> = new EventEmitter<DebugSessionCustomEvent>();
    private breakpointsChangedEvent: EventEmitter<BreakpointsChangeEvent> = new EventEmitter<BreakpointsChangeEvent>();

    constructor(@inject(IBufferDecoder) private bufferDecoder: IBufferDecoder) {
        noop();
    }

    public get activeDebugSession(): DebugSession | undefined {
        return this.session;
    }
    public get activeDebugConsole(): DebugConsole {
        return {
            append(_value: string): void {
                noop();
            },
            appendLine(_value: string): void {
                noop();
            }
        }
    }
    public get breakpoints(): Breakpoint[] {
        return [];
    }
    public get onDidChangeActiveDebugSession(): Event<DebugSession | undefined> {
        return this.sessionChangedEvent.event;
    }
    public get onDidStartDebugSession(): Event<DebugSession> {
        return this.sessionStartedEvent.event;
    }
    public get onDidReceiveDebugSessionCustomEvent(): Event<DebugSessionCustomEvent> {
        return this.sessionCustomEvent.event;
    }
    public get onDidTerminateDebugSession(): Event<DebugSession> {
        return this.sessionTerminatedEvent.event;
    }
    public get onDidChangeBreakpoints(): Event<BreakpointsChangeEvent> {
        return this.breakpointsChangedEvent.event;
    }
    public registerDebugConfigurationProvider(_debugType: string, _provider: DebugConfigurationProvider): Disposable {
        throw new Error('Method not implemented.');
    }
    public startDebugging(folder: WorkspaceFolder | undefined, nameOrConfiguration: string | DebugConfiguration, _parentSession?: DebugSession | undefined): Thenable<boolean> {
        // Should have a port number. We'll assume during the test it's local
        const config = nameOrConfiguration as DebugConfiguration;
        if (config.port) {
            this.socket = net.createConnection(config.port);
            this.socket.on('data', this.onReceivedData.bind(this));
            this.socket.on('error', this.onReceivedError.bind(this));
            this.socket.on('end', this.onDebuggingStopped.bind(this));
            this.breakStatePromise = createDeferred();
            return this.sendStartSequence(config.port, uuid());
        }
        return Promise.resolve(true);
    }
    public addBreakpoints(breakpoints: Breakpoint[]): void {
        noop();
    }
    public removeBreakpoints(breakpoints: Breakpoint[]): void {
        noop();
    }
    public async waitForBreakState(): Promise<void> {
        if (this.breakStatePromise) {
            return this.breakStatePromise.promise;
        }
    }

    private async sendStartSequence(port: number, sessionId: string): Promise<boolean> {
        this.sessionId = sessionId;
        await this.sendAttach(port, sessionId);
        await this.sendInitialize();
        await this.sendConfigurationDone();
        return true;
    }

    private sendAttach(port: number, sessionId: string): Promise<void> {
        // Send our attach request
        return this.sendMessage(
            'attach',
            {
                name: 'IPython',
                request: 'attach',
                type: 'python',
                port,
                host: 'localhost',
                justMyCode: true,
                logToFile: true,
                debugOptions: ['RedirectOutput', 'FixFilePathCase', 'WindowsClient', 'ShowReturnValue'],
                showReturnValue: true,
                workspaceFolder: 'd:\\Training\\SnakePython',
                pathMappings: [{ localRoot: 'd:\\Training\\SnakePython', remoteRoot: 'd:\\Training\\SnakePython' }],
                __sessionId: sessionId
            }
        );
    }

    private sendConfigurationDone(): Promise<void> {
        return this.sendMessage('configurationDone');
    }

    private sendInitialize(): Promise<void> {
        // Send our initialize request. (Got this by dumping debugAdapter output during real run. Set logToFile to true to generate)
        return this.sendMessage(
            'initialize',
            {
                clientID: 'vscode',
                clientName: 'Visual Studio Code',
                adapterID: 'python',
                pathFormat: 'path',
                linesStartAt1: true,
                columnsStartAt1: true,
                supportsVariableType: true,
                supportsVariablePaging: true,
                supportsRunInTerminalRequest: true,
                locale: 'en-us'
            }
        );
    }

    private sendMessage(command: string, args?: any): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                if (this.socket) {
                    const obj = {
                        command,
                        arguments: args,
                        type: 'request',
                        seq: this.sequence
                    };
                    this.sequence += 1;
                    const objString = JSON.stringify(obj);
                    const message = `Content-Length: ${objString.length}\r\n\r\n${objString}\r\n`;
                    this.socket.write(message, (a: any) => {
                        window.console.log(JSON.stringify(a));
                        resolve();
                    });
                }
            } catch (e) {
                reject(e);
            }
        });
    }

    private onReceivedData(data: Buffer) {
        const dataStr = this.bufferDecoder.decode([data], 'utf-8');

        // Need to wait for attach/initialize responses here.
        window.console.log(dataStr);
    }

    private onReceivedError(error: any) {
        window.console.log(error);
    }

    private onDebuggingStopped() {
        window.console.log('Debugging stopped ...');
    }
}
