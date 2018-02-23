// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-func-body-length no-empty no-require-imports no-var-requires

if ((Reflect as any).metadata === undefined) {
    require('reflect-metadata');
}

import { Socket } from 'net';
import * as once from 'once';
import * as path from 'path';
import { PassThrough } from 'stream';
import { Disposable } from 'vscode';
import { DebugSession, ErrorDestination, logger, OutputEvent, TerminatedEvent } from 'vscode-debugadapter';
import { LogLevel } from 'vscode-debugadapter/lib/logger';
import { Event } from 'vscode-debugadapter/lib/messages';
import { DebugProtocol } from 'vscode-debugprotocol';
import '../../client/common/extensions';
import { nop } from '../common/constants';
import { createDeferred, Deferred, isNotInstalledError } from '../common/helpers';
import { IServiceContainer } from '../ioc/types';
import { AttachRequestArguments, LaunchRequestArguments } from './Common/Contracts';
import { DebugClient } from './DebugClients/DebugClient';
import { CreateLaunchDebugClient } from './DebugClients/DebugFactory';
import { BaseDebugServer } from './DebugServers/BaseDebugServer';
import { initializeIoc } from './serviceRegistry';
import { IDebugStreamProvider, IProtocolLogger, IProtocolMessageWriter, IProtocolParser } from './types';

const DEBUGGER_CONNECT_TIMEOUT = 20000;
const MIN_DEBUGGER_CONNECT_TIMEOUT = 5000;

/**
 * Primary purpose of this class is to perform the handshake with VS Code (bootstrap the debug session).
 * I.e. it communicate with VS Code before PTVSD gets into the picture, once PTVSD is launched it will talk directly to VS Code.
 * We're re-using DebugSession so we don't have to handle request/response and parse protocols ourselves.
 * @export
 * @class PythonDebugger
 * @extends {DebugSession}
 */
export class PythonDebugger extends DebugSession {
    public debugServer?: BaseDebugServer;
    public debugClient?: DebugClient<{}>;
    public client = createDeferred<Socket>();
    private supportsRunInTerminalRequest: boolean;
    private killDebuggerProces: boolean;
    constructor(private readonly serviceContainer: IServiceContainer) {
        super(false);
    }
    public shutdown(processId?: number): void {
        if (this.debugServer) {
            this.debugServer.Stop();
            this.debugServer = undefined;
        }
        if (this.debugClient) {
            this.debugClient.Stop();
            this.debugClient = undefined;
        }
        super.shutdown();
    }
    protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
        const body = response.body!;

        body.supportsExceptionInfoRequest = true;
        body.supportsConfigurationDoneRequest = true;
        body.supportsConditionalBreakpoints = true;
        body.supportsSetVariable = true;
        body.supportsExceptionOptions = true;
        body.exceptionBreakpointFilters = [
            {
                filter: 'raised',
                label: 'Raised Exceptions',
                default: false
            },
            {
                filter: 'uncaught',
                label: 'Uncaught Exceptions',
                default: true
            }
        ];
        if (typeof args.supportsRunInTerminalRequest === 'boolean') {
            this.supportsRunInTerminalRequest = args.supportsRunInTerminalRequest;
        }
        this.sendResponse(response);
    }
    protected attachRequest(response: DebugProtocol.AttachResponse, args: AttachRequestArguments): void {
        this.sendResponse(response);
    }
    protected launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments): void {
        this.killDebuggerProces = true;

        this.startPTVSDDebugger(args)
            .then(() => this.waitForDebuggerConnection(args))
            .then(() => this.sendResponse(response))
            .catch(ex => {
                const message = this.getErrorUserFriendlyMessage(args, ex) || 'Debug Error';
                this.sendErrorResponse(response, { format: message, id: 1 }, undefined, undefined, ErrorDestination.User);
            });
    }
    private async startPTVSDDebugger(args: LaunchRequestArguments) {
        const launcher = CreateLaunchDebugClient(args, this, this.supportsRunInTerminalRequest);
        this.debugServer = launcher.CreateDebugServer(undefined, this.serviceContainer);
        const serverInfo = await this.debugServer!.Start();
        return launcher.LaunchApplicationToDebug(serverInfo);
    }
    private async waitForDebuggerConnection(args: LaunchRequestArguments) {
        return new Promise<void>(async (resolve, reject) => {
            let rejected = false;
            const duration = this.getConnectionTimeout(args);
            const timeout = setTimeout(() => {
                rejected = true;
                reject(new Error('Timeout waiting for debugger connection'));
            }, duration);

            try {
                await this.debugServer!.client;
                timeout.unref();
                if (!rejected) {
                    resolve();
                }
            } catch (ex) {
                reject(ex);
            }
        });
    }
    private getConnectionTimeout(args: LaunchRequestArguments) {
        // The timeout can be overridden, but won't be documented unless we see the need for it.
        // This is just a fail safe mechanism, if the current timeout isn't enough (let study the current behaviour before exposing this setting).
        const connectionTimeout = typeof (args as any).timeout === 'number' ? (args as any).timeout as number : DEBUGGER_CONNECT_TIMEOUT;
        return Math.max(connectionTimeout, MIN_DEBUGGER_CONNECT_TIMEOUT);
    }
    private getErrorUserFriendlyMessage(launchArgs: LaunchRequestArguments, error: any): string | undefined {
        if (!error) {
            return;
        }
        const errorMsg = typeof error === 'string' ? error : ((error.message && error.message.length > 0) ? error.message : '');
        if (isNotInstalledError(error)) {
            return `Failed to launch the Python Process, please validate the path '${launchArgs.pythonPath}'`;
        } else {
            return errorMsg;
        }
    }
}

/**
 * Glue that orchestrates communications between VS Code, PythonDebugger (DebugSession) and PTVSD.
 * @class DebugManager
 * @implements {Disposable}
 */
class DebugManager implements Disposable {
    private readonly serviceContainer: IServiceContainer;
    // #region VS Code debug Streams.
    private inputStream: NodeJS.ReadStream | Socket;
    private outputStream: NodeJS.WriteStream | Socket;
    // #endregion
    // #region Proxy Streams (used to listen in on the communications).
    private readonly throughOutputStream: PassThrough;
    private readonly throughInputStream: PassThrough;
    // #endregion
    // #region Streams used by the PythonDebug class (DebugSession).
    private readonly debugSessionOutputStream: PassThrough;
    private readonly debugSessionInputStream: PassThrough;
    // #endregion
    private readonly inputProtocolParser: IProtocolParser;
    private readonly outputProtocolParser: IProtocolParser;
    private readonly ptvsdOutputProtocolParser: IProtocolParser;
    private readonly protocolLogger: IProtocolLogger;
    private readonly protocolMessageWriter: IProtocolMessageWriter;
    private isServerMode: boolean;
    private readonly disposables: Disposable[] = [];
    private disposed: boolean;
    private debugSession?: PythonDebugger;
    private ptvsdProcessId?: number;
    private killPTVSDProcess: boolean;
    private terminatedEventSent: boolean;
    private readonly initializeRequestDeferred: Deferred<DebugProtocol.InitializeRequest>;
    private get initializeRequestReceived(): Promise<DebugProtocol.InitializeRequest> {
        return this.initializeRequestDeferred.promise;
    }
    private readonly launchRequestDeferred: Deferred<DebugProtocol.LaunchRequest>;
    private get launchRequestReceived(): Promise<DebugProtocol.LaunchRequest> {
        return this.launchRequestDeferred.promise;
    }

    private set loggingEnabled(value: boolean) {
        if (value) {
            logger.setup(LogLevel.Verbose, true);
            this.protocolLogger.setup(logger);
        } else {
            this.protocolLogger.disconnect();
        }
    }
    constructor() {
        this.serviceContainer = initializeIoc();
        this.throughInputStream = new PassThrough();
        this.throughOutputStream = new PassThrough();

        this.inputProtocolParser = this.serviceContainer.get<IProtocolParser>(IProtocolParser);
        this.inputProtocolParser.connect(this.throughInputStream);
        this.disposables.push(this.inputProtocolParser);
        this.outputProtocolParser = this.serviceContainer.get<IProtocolParser>(IProtocolParser);
        this.outputProtocolParser.connect(this.throughOutputStream);
        this.disposables.push(this.outputProtocolParser);

        this.ptvsdOutputProtocolParser = this.serviceContainer.get<IProtocolParser>(IProtocolParser);
        this.disposables.push(this.ptvsdOutputProtocolParser);

        this.protocolLogger = this.serviceContainer.get<IProtocolLogger>(IProtocolLogger);
        this.protocolLogger.connect(this.throughInputStream, this.throughOutputStream);
        this.disposables.push(this.protocolLogger);

        this.initializeRequestDeferred = createDeferred<DebugProtocol.InitializeRequest>();
        this.launchRequestDeferred = createDeferred<DebugProtocol.LaunchRequest>();
    }
    public dispose() {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        this.disposeImplementation().ignoreErrors();
    }
    public async initialize() {
        const debugStreamProvider = this.serviceContainer.get<IDebugStreamProvider>(IDebugStreamProvider);
        const { input, output } = await debugStreamProvider.getInputAndOutputStreams();
        this.isServerMode = debugStreamProvider.useDebugSocketStream;
        logger.init(nop, path.join(__dirname, '..', '..', '..', 'experimental_debug.log'));
        this.inputStream = input;
        this.outputStream = output;
        this.inputStream.pause();
    }
    private async disposeImplementation() {
        this.disposables.forEach(disposable => disposable.dispose());
        // Wait for sometime, untill the messages are sent out (remember, we're just intercepting streams here).
        // Also its possible PTVSD might run to completion.
        await new Promise(resolve => setTimeout(resolve, 500));
        if (debuggerSocket) {
            throughInStream.unpipe(debuggerSocket);
            debuggerSocket.unpipe(throughOutStream);
        }
        if (!this.terminatedEventSent) {
            // Possible VS Code has closed its stream.
            try {
                this.sendMessage(new TerminatedEvent());
                // Wait for this message to go out before we proceed (the process will die after this).
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch { }
            this.terminatedEventSent = true;
        }
        if (this.killPTVSDProcess && this.ptvsdProcessId) {
            try {
                process.kill(this.ptvsdProcessId);
            } catch { }
        }
        if (this.debugSession) {
            this.debugSession.shutdown();
        }
    }
    private sendMessage(message: DebugProtocol.ProtocolMessage): void {
        this.protocolMessageWriter.write(this.outputStream, message);
    }
    private startDebugSession() {
        this.debugSession = new PythonDebugger(this.serviceContainer);
        this.debugSession.setRunAsServer(this.isServerMode);

        // Connect our intermetiate pipes.
        this.throughOutputStream.pipe(this.outputStream);
        this.debugSessionOutputStream.pipe(this.throughOutputStream);

        // Start handling requests in the session instance.
        // The session (PythonDebugger class) will only perform the bootstrapping (launching of PTVSD).
        this.throughInputStream.pipe(this.debugSessionInputStream);
        this.inputStream.pipe(this.throughInputStream);

        this.debugSession.start(this.debugSessionInputStream, this.debugSessionOutputStream);
        this.inputStream.resume();
    }
    private setupRequestHooks() {
        // Keep track of the initialize and launch requests, we'll need to re-send these to ptvsd, for bootstrapping.
        this.inputProtocolParser.once('request_initialize', this.onRequestInitialize);
        this.inputProtocolParser.once('request_launch', this.onRequestLaunch);

        this.outputProtocolParser.once('event_terminated', this.onEventTerminated);

        // Keep track of processid for killing it.
        this.ptvsdOutputProtocolParser.once('event_process', this.onEventProcess);
        // Wait for PTVSD to reply back with initialized event, once it does, this means PTVSD is ready.
        this.ptvsdOutputProtocolParser.once('event_initialized', this.onEventInitialized);
    }
    private onRequestInitialize = (request: DebugProtocol.InitializeRequest) => {
        this.initializeRequestDeferred.resolve(request);
    }
    private onRequestLaunch = (request: DebugProtocol.LaunchRequest) => {
        this.killPTVSDProcess = true;
        this.loggingEnabled = (request.arguments as LaunchRequestArguments).logToFile === true;
        this.launchRequestDeferred.resolve(request);
        // NOTE: Beyond this point we're no longer interested in listing to what VS Code has to say.
        this.inputProtocolParser.dispose();
    }
    private onEventProcess = (proc: DebugProtocol.ProcessEvent) => {
        this.ptvsdProcessId = proc.body.systemProcessId;
    }
    private onEventInitialized = (initialized: DebugProtocol.InitializedEvent) => {

    }
    private onEventTerminated = (proc: DebugProtocol.TerminatedEvent) => {

    }
}

async function startDebugger() {
    const serviceContainer = initializeIoc();
    const debugStreamProvider = serviceContainer.get<IDebugStreamProvider>(IDebugStreamProvider);
    const { input, output } = await debugStreamProvider.getInputAndOutputStreams();
    const isServerMode = debugStreamProvider.useDebugSocketStream;
    const protocolMessageWriter = serviceContainer.get<IProtocolMessageWriter>(IProtocolMessageWriter);
    // tslint:disable-next-line:no-empty
    logger.init(() => { }, path.join(__dirname, '..', '..', '..', 'experimental_debug.log'));
    const stdin = input;
    const stdout = output;

    try {
        stdin.pause();
        const handshakeDebugOutStream = new PassThrough();
        const handshakeDebugInStream = new PassThrough();
        const throughOutStream = new PassThrough();
        const throughInStream = new PassThrough();

        const inputProtocolParser = serviceContainer.get<IProtocolParser>(IProtocolParser);
        inputProtocolParser.connect(throughInStream);
        const outputProtocolParser = serviceContainer.get<IProtocolParser>(IProtocolParser);
        outputProtocolParser.connect(throughOutStream);

        const protocolLogger = serviceContainer.get<IProtocolLogger>(IProtocolLogger);
        protocolLogger.connect(throughInStream, throughOutStream);
        function enableDisableLogging(enabled: boolean) {
            if (enabled) {
                logger.setup(LogLevel.Verbose, true);
                protocolLogger.setup(logger);
            } else {
                protocolLogger.disconnect();
            }
        }

        // Keep track of the initialize and launch requests, we'll need to re-send these to ptvsd, for bootstrapping.
        const initializeRequest = new Promise<DebugProtocol.InitializeRequest>(resolve => inputProtocolParser.on('request_initialize', resolve));
        const launchRequest = new Promise<DebugProtocol.LaunchRequest>(resolve => {
            inputProtocolParser.on('request_launch', (data: DebugProtocol.LaunchRequest) => {
                const enableLogging = (data.arguments as LaunchRequestArguments).logToFile === true;
                enableDisableLogging(enableLogging);
                resolve(data);
                inputProtocolParser.dispose();
            });
        });

        // Connect our intermetiate pipes.
        throughOutStream.pipe(stdout);
        handshakeDebugOutStream.pipe(throughOutStream);

        // Lets start our debugger.
        const session = new PythonDebugger(serviceContainer);
        session.setRunAsServer(isServerMode);
        let debuggerProcessId: number | undefined;
        let terminatedEventSent = false;
        let debuggerSocket: Socket | undefined;

        const dispose = once(async () => {
            // Wait for sometime, untill the messages are sent out (remember, we're just intercepting streams here).
            // Also its possible PTVSD might run to completion.
            await new Promise(resolve => setTimeout(resolve, 500));
            if (debuggerSocket) {
                throughInStream.unpipe(debuggerSocket);
                debuggerSocket.unpipe(throughOutStream);
            }
            if (!terminatedEventSent) {
                // Possible VS Code has closed its stream.
                try {
                    protocolMessageWriter.write(stdout, new TerminatedEvent());
                    // Wait for this message to go out before we proceed (the process will die after this).
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch { }
                terminatedEventSent = true;
            }
            session.shutdown(debuggerProcessId);
        });

        outputProtocolParser.once('event_terminated', () => {
            terminatedEventSent = true;
            dispose().catch(() => { });
        });
        // When VS Code sends a disconnect request, PTVSD replies back with a response, but its upto us to kill the process.
        // Wait for sometime, untill the messages are sent out (remember, we're just intercepting streams here).
        // Also its possible PTVSD might run to completion.
        outputProtocolParser.once('response_disconnect', () => setTimeout(dispose, 500));
        if (!isServerMode) {
            process.on('SIGTERM', dispose);
        }

        outputProtocolParser.on('response_launch', async () => {
            // By now we're connected to the client.
            debuggerSocket = await session.debugServer!.client;
            // We need to handle both end and error, sometimes the socket will error out without ending (if debugee is killed).
            debuggerSocket.on('end', dispose);
            debuggerSocket.on('error', dispose);

            const debugSoketProtocolParser = serviceContainer.get<IProtocolParser>(IProtocolParser);
            debugSoketProtocolParser.connect(debuggerSocket);

            // Send PTVSD a bogus launch request, and wait for it to respond.
            // This needs to be done, so PTVSD can keep track of how it was launched (whether it as for attach or launch).
            protocolMessageWriter.write(debuggerSocket, await launchRequest);
            await new Promise(resolve => debugSoketProtocolParser.once('response_launch', resolve));

            // The PTVSD process has launched, now send the initialize request to it.
            protocolMessageWriter.write(debuggerSocket, await initializeRequest);

            // Keep track of processid for killing it.
            debugSoketProtocolParser.once('event_process', (proc: DebugProtocol.ProcessEvent) => debuggerProcessId = proc.body.systemProcessId);

            // Wait for PTVSD to reply back with initialized event.
            debugSoketProtocolParser.once('event_initialized', (initialized: DebugProtocol.InitializedEvent) => {
                // Get ready for PTVSD to communicate directly with VS Code.
                throughInStream.unpipe(handshakeDebugInStream);
                throughInStream.pipe(debuggerSocket!);
                debuggerSocket!.pipe(throughOutStream);
                // Forward the initialized event sent by PTVSD onto VSCode.
                // This is what will cause PTVSD to start the actualy work.
                protocolMessageWriter.write(throughOutStream, initialized);
            });
        });

        // Start handling requests in the session instance.
        // The session (PythonDebugger class) will only perform the bootstrapping (launching of PTVSD).
        throughInStream.pipe(handshakeDebugInStream);
        stdin.pipe(throughInStream);
        session.start(handshakeDebugInStream, handshakeDebugOutStream);
        stdin.resume();
    } catch (ex) {
        logger.error(`Debugger crashed.${ex.message}`);
        protocolMessageWriter.write(stdout, new Event('error', `Debugger Error: ${ex.message}`));
        protocolMessageWriter.write(stdout, new OutputEvent(ex.toString(), 'stderr'));
    }
}

process.stdin.on('error', () => { });
process.stdout.on('error', () => { });
process.stderr.on('error', () => { });

process.on('uncaughtException', (err: Error) => {
    logger.error(`Uncaught Exception: ${err && err.message ? err.message : ''}`);
    logger.error(err && err.name ? err.name : '');
    logger.error(err && err.stack ? err.stack : '');
    // Catch all, incase we have string exceptions being raised.
    logger.error(err ? err.toString() : '');
    // Wait for 1 second before we die, we need to ensure errors are written to the log file.
    setTimeout(() => process.exit(-1), 1000);
});

startDebugger().catch(ex => {
    // Not necessary except for debugging and to kill linter warning about unhandled promises.
});
