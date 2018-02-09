'use strict';

// tslint:disable:no-any max-func-body-length
if ((Reflect as any).metadata === undefined) {
    // tslint:disable-next-line:no-require-imports no-var-requires
    require('reflect-metadata');
}

import * as fs from 'fs';
import { Socket } from 'net';
import * as path from 'path';
import { PassThrough } from 'stream';
import { DebugSession, ErrorDestination, logger, OutputEvent, TerminatedEvent } from 'vscode-debugadapter';
import { LogLevel } from 'vscode-debugadapter/lib/logger';
import { DebugProtocol } from 'vscode-debugprotocol';
import { createDeferred, isNotInstalledError } from '../common/helpers';
import { ISocketServer } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { AttachRequestArguments, LaunchRequestArguments } from './Common/Contracts';
import { Event } from './Common/messages';
import { CreateLaunchDebugClient } from './DebugClients/DebugFactory';
import { BaseDebugServer } from './DebugServers/BaseDebugServer';
import { initializeIoc } from './serviceRegistry';
import { IDebugStreamProvider, IProtocolLogger, IProtocolMessageWriter, IProtocolParser } from './types';

export class PythonDebugger extends DebugSession {
    public debugServer?: BaseDebugServer;
    public client = createDeferred<Socket>();
    private supportsRunInTerminalRequest: boolean;
    constructor(private readonly serviceContainer: IServiceContainer,
        isServer?: boolean) {
        super(false, isServer);
    }
    public static async run() {
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
            // const inParser = new PassThrough();
            // throughInStream.pipe(inParser);
            inputProtocolParser.connect(throughInStream);
            const outputProtocolParser = serviceContainer.get<IProtocolParser>(IProtocolParser);
            // const outParser = new PassThrough();
            // throughOutStream.pipe(outParser);
            outputProtocolParser.connect(throughOutStream);

            const protocolLogger = serviceContainer.get<IProtocolLogger>(IProtocolLogger);
            protocolLogger.connect(throughInStream, throughOutStream);

            // Keep track of the initialize message, we'll need to re-send this to ptvsd, for bootstrapping.
            const initializeRequest = new Promise<DebugProtocol.InitializeRequest>(resolve => {
                inputProtocolParser.on('request_initialize', (data) => {
                    resolve(data);
                    inputProtocolParser.dispose();
                });
            });

            throughOutStream.pipe(stdout);
            handshakeDebugOutStream.pipe(throughOutStream);

            // Lets start our debugger.
            const session = new PythonDebugger(serviceContainer, isServerMode);
            session.setRunAsServer(isServerMode);

            function dispose() {
                debugger;
                if (session) {
                    session.shutdown();
                }
            }
            outputProtocolParser.once('event_terminated', dispose);
            outputProtocolParser.once('response_disconnect', dispose);
            if (!isServerMode) {
                process.on('SIGTERM', dispose);
            }

            // Pause all input streams and stop piping input into our debug stream.
            session.on('_py_pre_launch', () => {
                throughInStream.pause();
                stdin.pause();
                throughInStream.unpipe(handshakeDebugInStream);
            });
            session.on('_py_enable_protocol_logging', enabled => {
                if (enabled) {
                    logger.setup(LogLevel.Verbose, true);
                    protocolLogger.setup(logger);
                } else {
                    protocolLogger.dispose();
                }
            });

            outputProtocolParser.on('response_launch', async () => {
                const debuggerSocket = await session.debugServer!.client;
                const debugSoketProtocolParser = serviceContainer.get<IProtocolParser>(IProtocolParser);
                debugSoketProtocolParser.connect(debuggerSocket);

                // The PTVSD process has launched, now send the initialize request to it.
                const request = await initializeRequest;
                protocolMessageWriter.write(debuggerSocket, request);

                // Wait for PTVSD to reply back with initialized event.
                debugSoketProtocolParser.on('event_stopped', () => {
                    // tslint:disable-next-line:no-console
                    console.log('Event Stopped');
                });
                debugSoketProtocolParser.once('event_initialized', (initialized: DebugProtocol.InitializedEvent) => {
                    // debugSoketProtocolParser.dispose();

                    throughInStream.pipe(debuggerSocket);
                    //throughInStream.on('data', (data) => debuggerSocket.write(data));

                    // Just in case we need to jump start things.
                    // throughInStream.read(0);
                    // stdin.read(0);

                    // Lets leave this pipe connected, so we can send errors back.
                    // handshakeDebugOutStream.unpipe(throughOutStream);
                    debuggerSocket.pipe(throughOutStream);
                    const collectedData: Buffer[] = [];
                    // debugger;
                    // debuggerSocket.on('data', data => {
                    //     fs.appendFileSync('/Users/donjayamanne/.vscode/extensions/pythonVSCodeDebugger/out_log.log', data.toString('utf8'));
                    //     const writable = (stdout as NodeJS.WriteStream).write(data);
                    //     throughOutStream.write(data);
                    //     if (!writable) {
                    //         debugger;
                    //         // debuggerSocket.pause();
                    //         // (stdout as NodeJS.WriteStream).once('drain', () => debuggerSocket.resume());
                    //     }
                    // });

                    throughInStream.resume();
                    stdin.resume();

                    // Forward the initialized event sent by PTVSD onto VSCode.
                    protocolMessageWriter.write(throughOutStream, initialized);
                    // throughOutStream.unpipe(stdout);
                });
            });

            throughInStream.pipe(handshakeDebugInStream);
            stdin.pipe(throughInStream);
            session.start(handshakeDebugInStream, handshakeDebugOutStream);
            stdin.resume();
        } catch (ex) {
            debugger;
            logger.error(`Debugger crashed.${ex.message}`);
            const errorEvent = new Event('error', `Debugger Error: ${ex.message}`);
            protocolMessageWriter.write(stdout, errorEvent);
        }
    }
    public shutdown(): void {
        debugger;
        if (this.debugServer) {
            this.debugServer.Stop();
            this.debugServer = undefined;
        }
        super.shutdown();
    }
    protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
        const body = response.body!;
        body.supportsExceptionInfoRequest = true;
        body.supportsConfigurationDoneRequest = true;
        body.supportsConditionalBreakpoints = true;
        body.supportsSetVariable = true;
        body.exceptionBreakpointFilters = [
            {
                filter: 'raised',
                label: 'Raised Exceptions',
                default: true
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
        if ((args as any).logToFile === true) {
            this.emit('_py_enable_protocol_logging', true);
        } else {
            this.emit('_py_enable_protocol_logging', false);
        }

        this.emit('_py_pre_launch');

        this.startPTVSDDebugger(args)
            .then(() => this.sendResponse(response))
            .catch(ex => {
                const message = this.getErrorUserFriendlyMessage(args, ex) || 'Debug Error';
                this.sendErrorResponse(response, { format: message, id: 1 }, undefined, undefined, ErrorDestination.User);
            });
    }
    private async startPTVSDDebugger(args: LaunchRequestArguments) {
        // const socketServer = this.serviceContainer.get<ISocketServer>(ISocketServer);
        // const port = await socketServer.Start({ port: 8788 });
        // socketServer.client.then(socket => {
        //     this.client.resolve(socket);
        // });
        const launcher = CreateLaunchDebugClient(args, this, this.supportsRunInTerminalRequest);
        this.debugServer = launcher.CreateDebugServer(undefined, this.serviceContainer);
        const serverInfo = await this.debugServer!.Start();
        return launcher.LaunchApplicationToDebug(serverInfo, this.handleUnhandledProcessError.bind(this, args));
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
    private handleUnhandledProcessError(launchArgs: LaunchRequestArguments, error: any) {
        const errorMessage = this.getErrorUserFriendlyMessage(launchArgs, error);
        if (errorMessage) {
            this.sendEvent(new Event('error', errorMessage));
            this.sendEvent(new OutputEvent(`${errorMessage}${'\n'}`, 'stderr'));
        }
        this.sendEvent(new TerminatedEvent());
    }
}

PythonDebugger.run().catch(ex => {
    // Not necessary except for perhaps debugging.
});
