// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-func-body-length no-empty no-require-imports no-var-requires

if ((Reflect as any).metadata === undefined) {
    require('reflect-metadata');
}

import * as fsextra from 'fs-extra';
import { Socket } from 'net';
import { EOL } from 'os';
import * as path from 'path';
import { PassThrough } from 'stream';
import { Disposable } from 'vscode';
import {
    DebugSession,
    ErrorDestination,
    Event,
    logger,
    OutputEvent,
    Response,
    TerminatedEvent
} from 'vscode-debugadapter';
import { LogLevel } from 'vscode-debugadapter/lib/logger';
import { DebugProtocol } from 'vscode-debugprotocol';
import { EXTENSION_ROOT_DIR } from '../../common/constants';
import '../../common/extensions';
import { isNotInstalledError } from '../../common/helpers';
import { ICurrentProcess, IDisposable, IDisposableRegistry } from '../../common/types';
import { createDeferred, Deferred, sleep } from '../../common/utils/async';
import { noop } from '../../common/utils/misc';
import { IServiceContainer } from '../../ioc/types';
import { AttachRequestArguments, LaunchRequestArguments } from '../types';
import { CreateAttachDebugClient, CreateLaunchDebugClient } from './DebugClients/DebugFactory';
import { BaseDebugServer } from './DebugServers/BaseDebugServer';
import { initializeIoc } from './serviceRegistry';
import { IDebugStreamProvider, IProtocolLogger, IProtocolMessageWriter, IProtocolParser } from './types';
const killProcessTree = require('tree-kill');

const DEBUGGER_CONNECT_TIMEOUT = 20000;
const MIN_DEBUGGER_CONNECT_TIMEOUT = 5000;

/**
 * Primary purpose of this class is to perform the handshake with VS Code and launch PTVSD process.
 * I.e. it communicate with VS Code before PTVSD gets into the picture, once PTVSD is launched, PTVSD will talk directly to VS Code.
 * We're re-using DebugSession so we don't have to handle request/response ourselves.
 * @export
 * @class PythonDebugger
 * @extends {DebugSession}
 */
export class PythonDebugger extends DebugSession {
    public debugServer?: BaseDebugServer;
    public client = createDeferred<Socket>();
    private supportsRunInTerminalRequest: boolean = false;
    constructor(
        private readonly serviceContainer: IServiceContainer,
        private readonly fileExistsSync = fsextra.existsSync
    ) {
        super(false);
    }
    public shutdown(): void {
        if (this.debugServer) {
            this.debugServer.Stop();
            this.debugServer = undefined;
        }
        super.shutdown();
    }
    protected initializeRequest(
        response: DebugProtocol.InitializeResponse,
        args: DebugProtocol.InitializeRequestArguments
    ): void {
        const body = response.body!;

        body.supportsExceptionInfoRequest = true;
        body.supportsConfigurationDoneRequest = true;
        body.supportsDelayedStackTraceLoading = true;
        body.supportsConditionalBreakpoints = true;
        body.supportsSetVariable = true;
        body.supportsExceptionOptions = true;
        body.supportsGotoTargetsRequest = true;
        body.supportsEvaluateForHovers = true;
        body.supportsModulesRequest = true;
        body.supportsValueFormattingOptions = true;
        body.supportsHitConditionalBreakpoints = true;
        body.supportsSetExpression = true;
        body.supportsLogPoints = true;
        body.supportTerminateDebuggee = true;
        body.supportsCompletionsRequest = true;
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
        const launcher = CreateAttachDebugClient(args, this);
        this.debugServer = launcher.CreateDebugServer(this.serviceContainer);
        this.debugServer!.Start()
            .then(() => this.emit('debugger_attached'))
            .catch(ex => {
                logger.error('Attach failed');
                logger.error(`${ex}, ${ex.name}, ${ex.message}, ${ex.stack}`);
                const message = this.getUserFriendlyAttachErrorMessage(ex) || 'Attach Failed';
                this.sendErrorResponse(
                    response,
                    { format: message, id: 1 },
                    undefined,
                    undefined,
                    ErrorDestination.User
                );
            });
    }
    protected launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments): void {
        if (
            (typeof args.module !== 'string' || args.module.length === 0) &&
            args.program &&
            !this.fileExistsSync(args.program)
        ) {
            return this.sendErrorResponse(
                response,
                { format: `File does not exist. "${args.program}"`, id: 1 },
                undefined,
                undefined,
                ErrorDestination.User
            );
        }

        this.launchPTVSD(args)
            .then(() => this.waitForPTVSDToConnect(args))
            .then(() => this.emit('debugger_launched'))
            .catch(ex => {
                const message = this.getUserFriendlyLaunchErrorMessage(args, ex) || 'Debug Error';
                this.sendErrorResponse(
                    response,
                    { format: message, id: 1 },
                    undefined,
                    undefined,
                    ErrorDestination.User
                );
            });
    }
    private async launchPTVSD(args: LaunchRequestArguments) {
        const launcher = CreateLaunchDebugClient(args, this, this.supportsRunInTerminalRequest);
        this.debugServer = launcher.CreateDebugServer(this.serviceContainer);
        const serverInfo = await this.debugServer!.Start();
        return launcher.LaunchApplicationToDebug(serverInfo);
    }
    private async waitForPTVSDToConnect(args: LaunchRequestArguments) {
        return new Promise<void>(async (resolve, reject) => {
            let rejected = false;
            const duration = this.getConnectionTimeout(args);
            const timeout = setTimeout(() => {
                rejected = true;
                reject(new Error('Timeout waiting for debugger connection'));
            }, duration);

            try {
                await this.debugServer!.client;
                clearTimeout(timeout);
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
        const connectionTimeout =
            typeof (args as any).timeout === 'number' ? ((args as any).timeout as number) : DEBUGGER_CONNECT_TIMEOUT;
        return Math.max(connectionTimeout, MIN_DEBUGGER_CONNECT_TIMEOUT);
    }
    private getUserFriendlyLaunchErrorMessage(launchArgs: LaunchRequestArguments, error: any): string | undefined {
        if (!error) {
            return;
        }
        const errorMsg =
            typeof error === 'string' ? error : error.message && error.message.length > 0 ? error.message : '';
        if (isNotInstalledError(error)) {
            return `Failed to launch the Python Process, please validate the path '${launchArgs.pythonPath}'`;
        } else {
            return errorMsg;
        }
    }
    private getUserFriendlyAttachErrorMessage(error: any): string | undefined {
        if (!error) {
            return;
        }
        if (error.code === 'ECONNREFUSED' || error.errno === 'ECONNREFUSED') {
            return `Failed to attach (${error.message})`;
        } else {
            return typeof error === 'string' ? error : error.message && error.message.length > 0 ? error.message : '';
        }
    }
}

/**
 * Glue that orchestrates communications between VS Code, PythonDebugger (DebugSession) and PTVSD.
 * @class DebugManager
 * @implements {Disposable}
 */
class DebugManager implements Disposable {
    // #region VS Code debug Streams.
    private inputStream!: NodeJS.ReadStream | Socket;
    private outputStream!: NodeJS.WriteStream | Socket;
    // #endregion
    // #region Proxy Streams (used to listen in on the communications).
    private readonly throughOutputStream: PassThrough;
    private readonly throughInputStream: PassThrough;
    // #endregion
    // #region Streams used by the PythonDebug class (DebugSession).
    private readonly debugSessionOutputStream: PassThrough;
    private readonly debugSessionInputStream: PassThrough;
    // #endregion
    // #region Streams used to communicate with PTVSD.
    private socket!: Socket;
    // #endregion
    private readonly inputProtocolParser: IProtocolParser;
    private readonly outputProtocolParser: IProtocolParser;
    private readonly protocolLogger: IProtocolLogger;
    private readonly protocolMessageWriter: IProtocolMessageWriter;
    private isServerMode: boolean = false;
    private readonly disposables: Disposable[] = [];
    private hasShutdown: boolean = false;
    private debugSession?: PythonDebugger;
    private ptvsdProcessId?: number;
    private launchOrAttach?: 'launch' | 'attach';
    private terminatedEventSent: boolean = false;
    private disconnectResponseSent: boolean = false;
    private disconnectRequest?: DebugProtocol.DisconnectRequest;
    private restart: boolean = false;
    private readonly initializeRequestDeferred: Deferred<DebugProtocol.InitializeRequest>;
    private get initializeRequest(): Promise<DebugProtocol.InitializeRequest> {
        return this.initializeRequestDeferred.promise;
    }
    private readonly launchRequestDeferred: Deferred<DebugProtocol.LaunchRequest>;
    private get launchRequest(): Promise<DebugProtocol.LaunchRequest> {
        return this.launchRequestDeferred.promise;
    }

    private readonly attachRequestDeferred: Deferred<DebugProtocol.AttachRequest>;
    private get attachRequest(): Promise<DebugProtocol.AttachRequest> {
        return this.attachRequestDeferred.promise;
    }

    private set loggingEnabled(value: boolean) {
        if (value) {
            logger.setup(LogLevel.Verbose, true);
            this.protocolLogger.setup(logger);
        }
    }
    constructor(private readonly serviceContainer: IServiceContainer) {
        this.throughInputStream = new PassThrough();
        this.throughOutputStream = new PassThrough();
        this.debugSessionOutputStream = new PassThrough();
        this.debugSessionInputStream = new PassThrough();

        this.protocolMessageWriter = this.serviceContainer.get<IProtocolMessageWriter>(IProtocolMessageWriter);

        this.inputProtocolParser = this.serviceContainer.get<IProtocolParser>(IProtocolParser);
        this.inputProtocolParser.connect(this.throughInputStream);
        this.disposables.push(this.inputProtocolParser);
        this.outputProtocolParser = this.serviceContainer.get<IProtocolParser>(IProtocolParser);
        this.outputProtocolParser.connect(this.throughOutputStream);
        this.disposables.push(this.outputProtocolParser);

        this.protocolLogger = this.serviceContainer.get<IProtocolLogger>(IProtocolLogger);
        this.protocolLogger.connect(this.throughInputStream, this.throughOutputStream);
        this.disposables.push(this.protocolLogger);

        this.initializeRequestDeferred = createDeferred<DebugProtocol.InitializeRequest>();
        this.launchRequestDeferred = createDeferred<DebugProtocol.LaunchRequest>();
        this.attachRequestDeferred = createDeferred<DebugProtocol.AttachRequest>();
    }
    public dispose() {
        try {
            const disposables = this.serviceContainer.get<IDisposable[]>(IDisposableRegistry);
            disposables.forEach(d => {
                try {
                    d.dispose();
                } catch {
                    noop();
                }
            });
        } catch {
            noop();
        }
        logger.verbose('main dispose');
        this.shutdown().ignoreErrors();
    }
    public async start() {
        const debugStreamProvider = this.serviceContainer.get<IDebugStreamProvider>(IDebugStreamProvider);
        this.disposables.push(debugStreamProvider);
        const { input, output } = await debugStreamProvider.getInputAndOutputStreams();
        this.isServerMode = debugStreamProvider.useDebugSocketStream;
        this.inputStream = input;
        this.outputStream = output;
        this.inputStream.pause();
        if (!this.isServerMode) {
            const currentProcess = this.serviceContainer.get<ICurrentProcess>(ICurrentProcess);
            currentProcess.on('SIGTERM', () => {
                if (!this.restart) {
                    this.shutdown().ignoreErrors();
                }
            });
        }
        this.interceptProtocolMessages();
        this.startDebugSession();
    }
    /**
     * Do not put any delays in here expecting VSC to receive messages. VSC could disconnect earlier (PTVSD #128).
     * If any delays are necessary, add them prior to calling this method.
     * If the program is forcefully terminated (e.g. killing terminal), we handle socket.on('error') or socket.on('close'),
     *  Under such circumstances, we need to send the terminated event asap (could be because VSC might be getting an error at its end due to piped stream being closed).
     * @private
     * @memberof DebugManager
     */
    // tslint:disable-next-line:cyclomatic-complexity
    private shutdown = async () => {
        logger.verbose('check and shutdown');
        if (this.hasShutdown) {
            return;
        }
        this.hasShutdown = true;
        logger.verbose('shutdown');

        if (!this.terminatedEventSent && !this.restart) {
            // Possible PTVSD died before sending message back.
            try {
                logger.verbose('Sending Terminated Event');
                this.sendMessage(new TerminatedEvent(), this.outputStream);
            } catch (err) {
                const message = `Error in sending Terminated Event: ${
                    err && err.message ? err.message : err.toString()
                }`;
                const details = [message, err && err.name ? err.name : '', err && err.stack ? err.stack : ''].join(EOL);
                logger.error(`${message}${EOL}${details}`);
            }
            this.terminatedEventSent = true;
        }

        if (!this.disconnectResponseSent && this.restart && this.disconnectRequest) {
            // This is a work around for PTVSD bug, else this entire block is unnecessary.
            try {
                logger.verbose('Sending Disconnect Response');
                this.sendMessage(new Response(this.disconnectRequest, ''), this.outputStream);
            } catch (err) {
                const message = `Error in sending Disconnect Response: ${
                    err && err.message ? err.message : err.toString()
                }`;
                const details = [message, err && err.name ? err.name : '', err && err.stack ? err.stack : ''].join(EOL);
                logger.error(`${message}${EOL}${details}`);
            }
            this.disconnectResponseSent = true;
        }

        if (this.launchOrAttach === 'launch' && this.ptvsdProcessId) {
            logger.verbose('killing process');
            try {
                // 1. Wait for some time, its possible the program has run to completion.
                // We need to wait till the process exits (else the message `Terminated: 15` gets printed onto the screen).
                // 2. Also, its possible we manually sent the `Terminated` event above.
                // Hence we need to wait till VSC receives the above event.
                await sleep(100);
                logger.verbose('Kill process now');
                killProcessTree(this.ptvsdProcessId!);
            } catch {}
            this.ptvsdProcessId = undefined;
        }

        if (!this.restart) {
            if (this.debugSession) {
                logger.verbose('Shutting down debug session');
                this.debugSession.shutdown();
            }

            logger.verbose('disposing');
            await sleep(100);
            // Dispose last, we don't want to dispose the protocol loggers too early.
            this.disposables.forEach(disposable => disposable.dispose());
        }
    };
    private sendMessage(
        message: DebugProtocol.ProtocolMessage,
        outputStream: Socket | PassThrough | NodeJS.WriteStream
    ): void {
        this.protocolMessageWriter.write(outputStream, message);
        this.protocolMessageWriter.write(this.throughOutputStream, message);
    }
    private startDebugSession() {
        this.debugSession = new PythonDebugger(this.serviceContainer);
        this.debugSession.setRunAsServer(this.isServerMode);

        this.debugSession.once('debugger_attached', this.connectVSCodeToPTVSD);
        this.debugSession.once('debugger_launched', this.connectVSCodeToPTVSD);

        this.debugSessionOutputStream.pipe(this.throughOutputStream);
        this.debugSessionOutputStream.pipe(this.outputStream);

        // Start handling requests in the session instance.
        // The session (PythonDebugger class) will only perform the bootstrapping (launching of PTVSD).
        this.inputStream.pipe(this.throughInputStream);
        this.inputStream.pipe(this.debugSessionInputStream);

        this.debugSession.start(this.debugSessionInputStream, this.debugSessionOutputStream);
    }
    private interceptProtocolMessages() {
        // Keep track of the initialize and launch requests, we'll need to re-send these to ptvsd, for bootstrapping.
        this.inputProtocolParser.once('request_initialize', this.onRequestInitialize);
        this.inputProtocolParser.once('request_launch', this.onRequestLaunch);
        this.inputProtocolParser.once('request_attach', this.onRequestAttach);
        this.inputProtocolParser.once('request_disconnect', this.onRequestDisconnect);

        this.outputProtocolParser.once('event_terminated', this.onEventTerminated);
        this.outputProtocolParser.once('response_disconnect', this.onResponseDisconnect);
    }
    /**
     * Connect PTVSD socket to VS Code.
     * This allows PTVSD to communicate directly with VS Code.
     * @private
     * @memberof DebugManager
     */
    private connectVSCodeToPTVSD = async (_response: DebugProtocol.AttachResponse | DebugProtocol.LaunchResponse) => {
        const attachOrLaunchRequest = await (this.launchOrAttach === 'attach'
            ? this.attachRequest
            : this.launchRequest);
        // By now we're connected to the client.
        this.socket = await this.debugSession!.debugServer!.client;

        // We need to handle both end and error, sometimes the socket will error out without ending (if debugee is killed).
        // Note, we need a handler for the error event, else nodejs complains when socket gets closed and there are no error handlers.
        this.socket.on('end', () => {
            logger.verbose('Socket End');
            this.shutdown().ignoreErrors();
        });
        this.socket.on('error', () => {
            logger.verbose('Socket Error');
            this.shutdown().ignoreErrors();
        });
        // Keep track of processid for killing it.
        if (this.launchOrAttach === 'launch') {
            const debugSoketProtocolParser = this.serviceContainer.get<IProtocolParser>(IProtocolParser);
            debugSoketProtocolParser.connect(this.socket);
            debugSoketProtocolParser.once('event_process', (proc: DebugProtocol.ProcessEvent) => {
                this.ptvsdProcessId = proc.body.systemProcessId;
            });
        }

        // Get ready for PTVSD to communicate directly with VS Code.
        ((this.inputStream as any) as NodeJS.ReadStream).unpipe(this.debugSessionInputStream);
        this.debugSessionOutputStream.unpipe(this.outputStream);

        // Do not pipe. When restarting the debugger, the socket gets closed,
        // In which case, VSC will see this and shutdown the debugger completely.
        ((this.inputStream as any) as NodeJS.ReadStream).on('data', data => {
            this.socket.write(data);
        });
        this.socket.on('data', (data: string | Buffer) => {
            this.throughOutputStream.write(data);
            this.outputStream.write(data as string);
        });

        // Send the launch/attach request to PTVSD and wait for it to reply back.
        this.sendMessage(attachOrLaunchRequest, this.socket);

        // Send the initialize request and wait for it to reply back with the initialized event
        this.sendMessage(await this.initializeRequest, this.socket);
    };
    private onRequestInitialize = (request: DebugProtocol.InitializeRequest) => {
        this.hasShutdown = false;
        this.terminatedEventSent = false;
        this.disconnectResponseSent = false;
        this.restart = false;
        this.disconnectRequest = undefined;
        this.initializeRequestDeferred.resolve(request);
    };
    private onRequestLaunch = (request: DebugProtocol.LaunchRequest) => {
        this.launchOrAttach = 'launch';
        this.loggingEnabled = (request.arguments as LaunchRequestArguments).logToFile === true;
        this.launchRequestDeferred.resolve(request);
    };
    private onRequestAttach = (request: DebugProtocol.AttachRequest) => {
        this.launchOrAttach = 'attach';
        this.loggingEnabled = (request.arguments as AttachRequestArguments).logToFile === true;
        this.attachRequestDeferred.resolve(request);
    };
    private onRequestDisconnect = (request: DebugProtocol.DisconnectRequest) => {
        this.disconnectRequest = request;
        if (this.launchOrAttach === 'attach') {
            return;
        }
        const args = request.arguments as { restart: boolean } | undefined;
        if (args && args.restart) {
            this.restart = true;
        }

        // When VS Code sends a disconnect request, PTVSD replies back with a response.
        // Wait for sometime, until the messages are sent out (remember, we're just intercepting streams here).
        setTimeout(this.shutdown, 500);
    };
    private onEventTerminated = async () => {
        logger.verbose('onEventTerminated');
        this.terminatedEventSent = true;
        // Wait for sometime, until the messages are sent out (remember, we're just intercepting streams here).
        setTimeout(this.shutdown, 300);
    };
    private onResponseDisconnect = async () => {
        this.disconnectResponseSent = true;
        logger.verbose('onResponseDisconnect');
        // When VS Code sends a disconnect request, PTVSD replies back with a response, but its upto us to kill the process.
        // Wait for sometime, until the messages are sent out (remember, we're just intercepting streams here).
        // Also its possible PTVSD might run to completion.
        setTimeout(this.shutdown, 100);
    };
}

async function startDebugger() {
    logger.init(noop, path.join(EXTENSION_ROOT_DIR, `debug${process.pid}.log`));
    const serviceContainer = initializeIoc();
    const protocolMessageWriter = serviceContainer.get<IProtocolMessageWriter>(IProtocolMessageWriter);
    try {
        // debugger;
        const debugManager = new DebugManager(serviceContainer);
        await debugManager.start();
    } catch (err) {
        const message = `Debugger Error: ${err && err.message ? err.message : err.toString()}`;
        const details = [message, err && err.name ? err.name : '', err && err.stack ? err.stack : ''].join(EOL);
        logger.error(`${message}${EOL}${details}`);

        // Notify the user.
        protocolMessageWriter.write(process.stdout, new Event('error', message));
        protocolMessageWriter.write(process.stdout, new OutputEvent(`${message}${EOL}${details}`, 'stderr'));
    }
}

process.stdin.on('error', () => {});
process.stdout.on('error', () => {});
process.stderr.on('error', () => {});

process.on('uncaughtException', (err: Error) => {
    logger.error(`Uncaught Exception: ${err && err.message ? err.message : ''}`);
    logger.error(err && err.name ? err.name : '');
    logger.error(err && err.stack ? err.stack : '');
    // Catch all, incase we have string exceptions being raised.
    logger.error(err ? err.toString() : '');
    // Wait for 1 second before we die, we need to ensure errors are written to the log file.
    setTimeout(() => process.exit(-1), 100);
});

startDebugger().catch(_ex => {
    // Not necessary except for debugging and to kill linter warning about unhandled promises.
});
