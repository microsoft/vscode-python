// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-func-body-length
if ((Reflect as any).metadata === undefined) {
    // tslint:disable-next-line:no-require-imports no-var-requires
    require('reflect-metadata');
}

import { Socket } from 'net';
import * as path from 'path';
import { PassThrough } from 'stream';
import { DebugSession, ErrorDestination, logger, OutputEvent, TerminatedEvent } from 'vscode-debugadapter';
import { LogLevel } from 'vscode-debugadapter/lib/logger';
import { Event } from 'vscode-debugadapter/lib/messages';
import { DebugProtocol } from 'vscode-debugprotocol';
import { createDeferred, isNotInstalledError } from '../common/helpers';
import { IServiceContainer } from '../ioc/types';
import { AttachRequestArguments, LaunchRequestArguments } from './Common/Contracts';
import { DebugClient } from './DebugClients/DebugClient';
import { CreateLaunchDebugClient } from './DebugClients/DebugFactory';
import { BaseDebugServer } from './DebugServers/BaseDebugServer';
import { initializeIoc } from './serviceRegistry';
import { IDebugStreamProvider, IProtocolLogger, IProtocolMessageWriter, IProtocolParser } from './types';

export class PythonDebugger extends DebugSession {
    public debugServer?: BaseDebugServer;
    public debugClient?: DebugClient<{}>;
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
            inputProtocolParser.connect(throughInStream);

            const outputProtocolParser = serviceContainer.get<IProtocolParser>(IProtocolParser);
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
            let terminatedEventSent = false;
            function dispose() {
                if (!terminatedEventSent) {
                    protocolMessageWriter.write(stdout, new TerminatedEvent());
                    terminatedEventSent = true;
                }
                session.shutdown();
            }
            outputProtocolParser.once('event_terminated', () => {
                terminatedEventSent = true;
                dispose();
            });
            if (!isServerMode) {
                process.on('SIGTERM', dispose);
            }

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
                debuggerSocket.on('end', dispose);
                debuggerSocket.on('error', dispose);
                const debugSoketProtocolParser = serviceContainer.get<IProtocolParser>(IProtocolParser);
                debugSoketProtocolParser.connect(debuggerSocket);

                // The PTVSD process has launched, now send the initialize request to it.
                const request = await initializeRequest;
                protocolMessageWriter.write(debuggerSocket, request);

                // Wait for PTVSD to reply back with initialized event.
                debugSoketProtocolParser.once('event_initialized', (initialized: DebugProtocol.InitializedEvent) => {
                    throughInStream.unpipe(handshakeDebugInStream);

                    throughInStream.pipe(debuggerSocket);

                    debuggerSocket.pipe(throughOutStream);

                    // Forward the initialized event sent by PTVSD onto VSCode.
                    protocolMessageWriter.write(throughOutStream, initialized);
                });
            });

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
    public shutdown(): void {
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
        const enableLogging = args.logToFile === true;
        this.emit('_py_enable_protocol_logging', enableLogging);

        this.emit('_py_pre_launch');

        this.startPTVSDDebugger(args)
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

PythonDebugger.run().catch(ex => {
    // Not necessary except for perhaps debugging.
});
