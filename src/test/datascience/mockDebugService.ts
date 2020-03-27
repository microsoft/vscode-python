// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import * as net from 'net';
import * as path from 'path';
import * as uuid from 'uuid/v4';
import {
    Breakpoint,
    BreakpointsChangeEvent,
    DebugAdapterTracker,
    DebugAdapterTrackerFactory,
    DebugConfiguration,
    DebugConfigurationProvider,
    DebugConsole,
    DebugSession,
    DebugSessionCustomEvent,
    Disposable,
    Event,
    EventEmitter,
    SourceBreakpoint,
    WorkspaceFolder,
} from 'vscode';
import { DebugProtocol } from 'vscode-debugprotocol';

import { IDebugService } from '../../client/common/application/types';
import { traceInfo } from '../../client/common/logger';
import { IDisposable } from '../../client/common/types';
import { createDeferred } from '../../client/common/utils/async';
import { noop } from '../../client/common/utils/misc';
import { EXTENSION_ROOT_DIR } from '../../client/constants';
import { IProtocolParser } from '../../client/debugger/debugAdapter/types';
import { DebugAdapterDescriptorFactory } from '../../client/debugger/extension/adapter/factory';

// tslint:disable:no-any

// For debugging set these environment variables
// PYDEV_DEBUG=True
// PTVSD_LOG_DIR=<dir that already exists>
// PYDEVD_DEBUG_FILE=<dir that exists, but new file allowed>
class MockDebugSession implements DebugSession {
    private _name = 'MockDebugSession';
    constructor(
        private _id: string,
        private _configuration: DebugConfiguration,
        private customRequestHandler: (command: string, args?: any) => Thenable<any>
    ) {
        noop();
    }
    public get id(): string {
        return this._id;
    }
    public get type(): string {
        return 'python';
    }
    public get name(): string {
        return this._name;
    }
    public get workspaceFolder(): WorkspaceFolder | undefined {
        return undefined;
    }
    public get configuration(): DebugConfiguration {
        return this._configuration;
    }
    public customRequest(command: string, args?: any): Thenable<any> {
        return this.customRequestHandler(command, args);
    }
}

//tslint:disable:trailing-comma no-any no-multiline-string
@injectable()
export class MockDebuggerService implements IDebugService, IDisposable {
    private socket: net.Socket | undefined;
    private session: DebugSession | undefined;
    private sequence: number = 1;
    private breakpointEmitter: EventEmitter<void> = new EventEmitter<void>();
    private debugAdapterTrackerFactory: DebugAdapterTrackerFactory | undefined;
    private debugAdapterTracker: DebugAdapterTracker | undefined;
    private sessionChangedEvent: EventEmitter<DebugSession> = new EventEmitter<DebugSession>();
    private sessionStartedEvent: EventEmitter<DebugSession> = new EventEmitter<DebugSession>();
    private sessionTerminatedEvent: EventEmitter<DebugSession> = new EventEmitter<DebugSession>();
    private sessionCustomEvent: EventEmitter<DebugSessionCustomEvent> = new EventEmitter<DebugSessionCustomEvent>();
    private breakpointsChangedEvent: EventEmitter<BreakpointsChangeEvent> = new EventEmitter<BreakpointsChangeEvent>();
    private _breakpoints: Breakpoint[] = [];
    private _stoppedThreadId: number | undefined;
    constructor(@inject(IProtocolParser) private protocolParser: IProtocolParser) {
        noop();
    }

    public dispose(): void {
        if (this.socket) {
            this.socket.end();
            this.socket = undefined;
        }
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
            },
        };
    }
    public get breakpoints(): Breakpoint[] {
        return this._breakpoints;
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

    public registerDebugAdapterDescriptorFactory(
        _debugType: string,
        _factory: DebugAdapterDescriptorFactory
    ): Disposable {
        throw new Error('Not implemented');
    }
    public registerDebugAdapterTrackerFactory(_debugType: string, _provider: DebugAdapterTrackerFactory): Disposable {
        this.debugAdapterTrackerFactory = _provider;
        return {
            dispose: () => {
                noop();
            },
        };
    }

    public startDebugging(
        _folder: WorkspaceFolder | undefined,
        nameOrConfiguration: string | DebugConfiguration,
        _parentSession?: DebugSession | undefined
    ): Thenable<boolean> {
        // Should have a port number. We'll assume during the test it's local
        const config = nameOrConfiguration as DebugConfiguration;
        if (config.port) {
            this.session = new MockDebugSession(uuid(), config, this.sendCustomRequest.bind(this));

            // Create our debug adapter tracker at session start
            if (this.debugAdapterTrackerFactory) {
                this.debugAdapterTracker = this.debugAdapterTrackerFactory.createDebugAdapterTracker(
                    this.session
                ) as DebugAdapterTracker;
            }

            this.socket = net.createConnection(config.port);
            this.protocolParser.connect(this.socket);
            this.protocolParser.on('event_stopped', this.onBreakpoint.bind(this));
            this.protocolParser.on('event_output', this.onOutput.bind(this));
            this.socket.on('error', this.onError.bind(this));
            this.socket.on('close', this.onClose.bind(this));
            return this.sendStartSequence(config.port, this.session.id);
        }
        return Promise.resolve(true);
    }
    public addBreakpoints(breakpoints: Breakpoint[]): void {
        this._breakpoints = this._breakpoints.concat(breakpoints);
    }
    public removeBreakpoints(_breakpoints: Breakpoint[]): void {
        noop();
    }
    public get onBreakpointHit(): Event<void> {
        return this.breakpointEmitter.event;
    }

    public async continue(): Promise<void> {
        await this.sendMessage('continue', { threadId: 0 });
        if (this.debugAdapterTracker && this.debugAdapterTracker.onDidSendMessage) {
            this.debugAdapterTracker.onDidSendMessage({ type: 'event', event: 'continue' });
        }
    }

    public async getStackTrace(): Promise<DebugProtocol.StackTraceResponse | undefined> {
        const deferred = createDeferred<DebugProtocol.StackTraceResponse>();
        this.protocolParser.once('response_stackTrace', (args: any) => {
            if (this.debugAdapterTracker && this.debugAdapterTracker.onDidSendMessage) {
                this.debugAdapterTracker.onDidSendMessage(args as DebugProtocol.StackTraceResponse);
            }
            deferred.resolve(args as DebugProtocol.StackTraceResponse);
        });
        await this.emitMessage('stackTrace', {
            threadId: this._stoppedThreadId ? this._stoppedThreadId : 1,
            startFrame: 0,
            levels: 1,
        });
        return deferred.promise;
    }

    private sendCustomRequest(command: string, args?: any): Promise<void> {
        return this.sendMessage(command, args);
    }

    private async sendStartSequence(port: number, sessionId: string): Promise<boolean> {
        await this.sendInitialize();
        await this.sendAttach(port, sessionId);
        if (this._breakpoints.length > 0) {
            await this.sendBreakpoints();
        }
        await this.sendConfigurationDone();
        return true;
    }

    private sendBreakpoints(): Promise<void> {
        // Only supporting a single file now
        const sbs = this._breakpoints.map((b) => b as SourceBreakpoint);
        const file = sbs[0].location.uri.fsPath;
        return this.sendMessage('setBreakpoints', {
            source: {
                name: path.basename(file),
                path: file,
            },
            lines: sbs.map((sb) => sb.location.range.start.line),
            breakpoints: sbs.map((sb) => {
                return { line: sb.location.range.start.line };
            }),
            sourceModified: true,
        });
    }

    private sendAttach(port: number, sessionId: string): Promise<void> {
        // Send our attach request
        return this.sendMessage('attach', {
            name: 'IPython',
            request: 'attach',
            type: 'python',
            port,
            host: 'localhost',
            justMyCode: true,
            logToFile: true,
            debugOptions: ['RedirectOutput', 'FixFilePathCase', 'WindowsClient', 'ShowReturnValue'],
            showReturnValue: true,
            workspaceFolder: EXTENSION_ROOT_DIR,
            pathMappings: [{ localRoot: EXTENSION_ROOT_DIR, remoteRoot: EXTENSION_ROOT_DIR }],
            __sessionId: sessionId,
        });
    }

    private sendConfigurationDone(): Promise<void> {
        return this.sendMessage('configurationDone');
    }

    private async sendInitialize(): Promise<void> {
        // Send our initialize request. (Got this by dumping debugAdapter output during real run. Set logToFile to true to generate)
        await this.sendMessage('initialize', {
            clientID: 'vscode',
            clientName: 'Visual Studio Code',
            adapterID: 'python',
            pathFormat: 'path',
            linesStartAt1: true,
            columnsStartAt1: true,
            supportsVariableType: true,
            supportsVariablePaging: true,
            supportsRunInTerminalRequest: true,
            locale: 'en-us',
        });
    }

    private async sendMessage(command: string, args?: any): Promise<void> {
        const response = createDeferred();
        this.protocolParser.once(`response_${command}`, () => response.resolve());
        this.socket!.on('error', (err) => response.reject(err));
        await this.emitMessage(command, args);
        await response.promise;
    }

    private emitMessage(command: string, args?: any): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                if (this.socket) {
                    const obj = {
                        command,
                        arguments: args,
                        type: 'request',
                        seq: this.sequence,
                    };
                    this.sequence += 1;
                    const objString = JSON.stringify(obj);
                    const message = `Content-Length: ${objString.length}\r\n\r\n${objString}`;
                    this.socket.write(message, (_a: any) => {
                        if (this.debugAdapterTracker && this.debugAdapterTracker.onDidSendMessage) {
                            this.debugAdapterTracker.onDidSendMessage(obj);
                        }
                        resolve();
                    });
                }
            } catch (e) {
                reject(e);
            }
        });
    }

    private onBreakpoint(args: DebugProtocol.StoppedEvent): void {
        // Save the current thread id. We use this in our stack trace request
        this._stoppedThreadId = args.body.threadId;

        if (this.debugAdapterTracker && this.debugAdapterTracker.onDidSendMessage) {
            this.debugAdapterTracker.onDidSendMessage(args);
        }

        // Indicate we stopped at a breakpoint
        this.breakpointEmitter.fire();
    }

    private onOutput(args: any): void {
        traceInfo(JSON.stringify(args));
    }

    private onError(args: any): void {
        traceInfo(JSON.stringify(args));
    }

    private onClose(): void {
        if (this.socket) {
            this.socket.end();
            this.socket = undefined;
        }
    }
}
