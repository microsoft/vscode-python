// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
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
    WorkspaceFolder
} from 'vscode';
import { DebugProtocol } from 'vscode-debugprotocol';
import { traceError, traceInfo } from '../common/logger';
import { IDisposable, IDisposableRegistry } from '../common/types';
import { createDeferred } from '../common/utils/async';
import { noop } from '../common/utils/misc';
import { EXTENSION_ROOT_DIR } from '../constants';
import { IProtocolParser } from '../debugger/debugAdapter/types';
import { DebugAdapterDescriptorFactory } from '../debugger/extension/adapter/factory';
import { IJupyterDebugService } from './types';

// tslint:disable:no-any

// For debugging set these environment variables
// PYDEV_DEBUG=True
// PTVSD_LOG_DIR=<dir that already exists>
// PYDEVD_DEBUG_FILE=<dir that exists, but new file allowed>
class JupyterDebugSession implements DebugSession {
    private _name = 'JupyterDebugSession';
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
/**
 * IJupyterDebugService that talks directly to the debugger. Supports both run by line and
 * regular debugging (regular is used in tests).
 */
@injectable()
export class JupyterDebugService implements IJupyterDebugService, IDisposable {
    private socket: net.Socket | undefined;
    private session: DebugSession | undefined;
    private sequence: number = 1;
    private breakpointEmitter: EventEmitter<void> = new EventEmitter<void>();
    private debugAdapterTrackerFactories: DebugAdapterTrackerFactory[] = [];
    private debugAdapterTrackers: DebugAdapterTracker[] = [];
    private sessionChangedEvent: EventEmitter<DebugSession> = new EventEmitter<DebugSession>();
    private sessionStartedEvent: EventEmitter<DebugSession> = new EventEmitter<DebugSession>();
    private sessionTerminatedEvent: EventEmitter<DebugSession> = new EventEmitter<DebugSession>();
    private sessionCustomEvent: EventEmitter<DebugSessionCustomEvent> = new EventEmitter<DebugSessionCustomEvent>();
    private breakpointsChangedEvent: EventEmitter<BreakpointsChangeEvent> = new EventEmitter<BreakpointsChangeEvent>();
    private _breakpoints: Breakpoint[] = [];
    private _stoppedThreadId: number | undefined;
    private _topFrameId: number | undefined;
    constructor(
        @inject(IProtocolParser) private protocolParser: IProtocolParser,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry
    ) {
        disposableRegistry.push(this);
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
            }
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
        return {
            dispose: () => {
                noop();
            }
        };
    }

    public registerDebugAdapterDescriptorFactory(
        _debugType: string,
        _factory: DebugAdapterDescriptorFactory
    ): Disposable {
        return {
            dispose: () => {
                noop();
            }
        };
    }
    public registerDebugAdapterTrackerFactory(_debugType: string, provider: DebugAdapterTrackerFactory): Disposable {
        this.debugAdapterTrackerFactories.push(provider);
        return {
            dispose: () => {
                this.debugAdapterTrackerFactories = this.debugAdapterTrackerFactories.filter((f) => f !== provider);
            }
        };
    }

    public startRunByLine(config: DebugConfiguration): Thenable<boolean> {
        // This is the same as normal debugging. Just a convenient entry point
        // in case we need to make it different.
        return this.startDebugging(undefined, config);
    }

    public startDebugging(
        _folder: WorkspaceFolder | undefined,
        nameOrConfiguration: string | DebugConfiguration,
        _parentSession?: DebugSession | undefined
    ): Thenable<boolean> {
        // Should have a port number. We'll assume it's local
        const config = nameOrConfiguration as DebugConfiguration; // NOSONAR
        if (config.port) {
            this.session = new JupyterDebugSession(uuid(), config, this.sendCustomRequest.bind(this));
            this.sessionChangedEvent.fire(this.session);

            // Create our debug adapter trackers at session start
            this.debugAdapterTrackers = this.debugAdapterTrackerFactories.map(
                (f) => f.createDebugAdapterTracker(this.session!) as DebugAdapterTracker // NOSONAR
            );

            this.socket = net.createConnection(config.port);
            this.protocolParser.connect(this.socket);
            this.protocolParser.on('event_stopped', this.onBreakpoint.bind(this));
            this.protocolParser.on('event_output', this.onOutput.bind(this));
            this.protocolParser.on('event_terminated', this.sendToTrackers.bind(this));
            this.socket.on('error', this.onError.bind(this));
            this.socket.on('close', this.onClose.bind(this));
            return this.sendStartSequence(config, this.session.id).then(() => true);
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
        this.sendToTrackers({ type: 'event', event: 'continue' });
    }

    public async step(): Promise<void> {
        await this.sendMessage('stepIn', { threadId: this._stoppedThreadId ? this._stoppedThreadId : 1 });
        this.sendToTrackers({ type: 'event', event: 'stepIn' });
    }

    public async getStack(): Promise<DebugProtocol.StackFrame[]> {
        const deferred = createDeferred<DebugProtocol.StackFrame[]>();
        this.protocolParser.once('response_stackTrace', (args: any) => {
            this.sendToTrackers(args);
            const response = args as DebugProtocol.StackTraceResponse;
            const frames = response.body.stackFrames ? response.body.stackFrames : [];
            deferred.resolve(frames);
            this._topFrameId = frames[0]?.id;
        });
        await this.emitMessage('stackTrace', {
            threadId: this._stoppedThreadId ? this._stoppedThreadId : 1,
            startFrame: 0,
            levels: 1
        });
        return deferred.promise;
    }

    public async requestVariables(): Promise<void> {
        // Need a stack trace so we have a topmost frame id
        await this.getStack();
        const deferred = createDeferred<void>();
        let variablesReference = 0;
        this.protocolParser.once('response_scopes', (args: any) => {
            this.sendToTrackers(args);
            // Get locals variables reference
            const response = args as DebugProtocol.ScopesResponse;
            if (response) {
                variablesReference = response.body.scopes[0].variablesReference;
            }
            this.emitMessage('variables', {
                threadId: this._stoppedThreadId ? this._stoppedThreadId : 1,
                variablesReference
            }).ignoreErrors();
        });
        this.protocolParser.once('response_variables', (args: any) => {
            this.sendToTrackers(args);
            deferred.resolve();
        });
        await this.emitMessage('scopes', {
            frameId: this._topFrameId ? this._topFrameId : 1
        });
        return deferred.promise;
    }

    public stop(): void {
        this.onClose();
    }

    private sendToTrackers(args: any) {
        this.debugAdapterTrackers.forEach((d) => d.onDidSendMessage!(args));
    }

    private sendCustomRequest(command: string, args?: any): Promise<any> {
        return this.sendMessage(command, args);
    }

    private async sendStartSequence(config: DebugConfiguration, sessionId: string): Promise<void> {
        traceInfo('Sending debugger initialize...');
        await this.sendInitialize();
        if (this._breakpoints.length > 0) {
            traceInfo('Sending breakpoints');
            await this.sendBreakpoints();
        }
        traceInfo('Sending debugger attach...');
        const attachPromise = this.sendAttach(config, sessionId);
        traceInfo('Sending configuration done');
        await this.sendConfigurationDone();
        traceInfo('Session started.');
        return attachPromise.then(() => {
            this.sessionStartedEvent.fire(this.session);
        });
    }

    private sendBreakpoints(): Promise<void> {
        // Only supporting a single file now
        const sbs = this._breakpoints.map((b) => b as SourceBreakpoint); // NOSONAR
        const file = sbs[0].location.uri.fsPath;
        return this.sendMessage('setBreakpoints', {
            source: {
                name: path.basename(file),
                path: file
            },
            lines: sbs.map((sb) => sb.location.range.start.line),
            breakpoints: sbs.map((sb) => {
                return { line: sb.location.range.start.line };
            }),
            sourceModified: true
        });
    }

    private sendAttach(config: DebugConfiguration, sessionId: string): Promise<void> {
        // Send our attach request
        return this.sendMessage('attach', {
            debugOptions: ['RedirectOutput', 'FixFilePathCase', 'WindowsClient', 'ShowReturnValue'],
            workspaceFolder: EXTENSION_ROOT_DIR,
            __sessionId: sessionId,
            ...config
        });
    }

    private sendConfigurationDone(): Promise<void> {
        return this.sendMessage('configurationDone');
    }

    private sendInitialize(): Promise<void> {
        // Send our initialize request. (Got this by dumping debugAdapter output during real run. Set logToFile to true to generate)
        return this.sendMessage('initialize', {
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
        });
    }

    private sendDisconnect(): Promise<void> {
        return this.sendMessage('disconnect', {});
    }

    private sendMessage(command: string, args?: any): Promise<any> {
        const response = createDeferred<any>();
        this.protocolParser.once(`response_${command}`, (resp: any) => {
            this.sendToTrackers(resp);
            response.resolve(resp.body);
        });
        this.socket!.on('error', (err) => response.reject(err)); // NOSONAR
        this.emitMessage(command, args).catch((exc) => {
            traceError(`Exception attempting to emit ${command} to debugger: `, exc);
        });
        return response.promise;
    }

    private emitMessage(command: string, args?: any): Promise<void> {
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
                    traceInfo(`Sending request to debugger: ${objString}`);
                    const message = `Content-Length: ${objString.length}\r\n\r\n${objString}`;
                    this.socket.write(message, (_a: any) => {
                        this.sendToTrackers(obj);
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
        this.sendToTrackers(args);

        // Indicate we stopped at a breakpoint
        this.breakpointEmitter.fire();
    }

    private onOutput(args: any): void {
        this.sendToTrackers(args);
        traceInfo(JSON.stringify(args));
    }

    private onError(args: any): void {
        this.sendToTrackers(args);
        traceInfo(JSON.stringify(args));
    }

    private onClose(): void {
        if (this.socket) {
            this.sessionTerminatedEvent.fire(this.activeDebugSession);
            this.session = undefined;
            this.sessionChangedEvent.fire(undefined);
            this.debugAdapterTrackers.forEach((d) => (d.onExit ? d.onExit(0, undefined) : noop()));
            this.debugAdapterTrackers = [];
            this.sendDisconnect().ignoreErrors();
            this.socket.destroy();
            this.socket = undefined;
        }
    }
}
