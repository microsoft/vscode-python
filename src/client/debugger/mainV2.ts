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

const DEBUGGER_CONNECT_TIMEOUT = 10000;
const MIN_DEBUGGER_CONNECT_TIMEOUT = DEBUGGER_CONNECT_TIMEOUT / 2;

export class PythonDebugger extends DebugSession {
    public debugServer?: BaseDebugServer;
    public debugClient?: DebugClient<{}>;
    public client = createDeferred<Socket>();
    private supportsRunInTerminalRequest: boolean;
    private killDebuggerProces: boolean;
    constructor(private readonly serviceContainer: IServiceContainer,
        isServer?: boolean) {
        super(false, isServer);
    }
    public shutdown(processId?: number): void {
        if (this.killDebuggerProces && processId) {
            try {
                process.kill(processId);
            } catch { }
        }
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
        const connectionTimeout = typeof (args as any).connectionTimeout === 'number' ? (args as any).connectionTimeout as number : DEBUGGER_CONNECT_TIMEOUT;
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
                protocolLogger.dispose();
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
        const session = new PythonDebugger(serviceContainer, isServerMode);
        session.setRunAsServer(isServerMode);
        let debuggerProcessId: number | undefined;
        let terminatedEventSent = false;
        let debuggerSocket: Socket | undefined;

        const dispose = once(() => {
            if (debuggerSocket) {
                throughInStream.unpipe(debuggerSocket);
                debuggerSocket.unpipe(throughOutStream);
            }
            session.shutdown(debuggerProcessId);
            if (!terminatedEventSent) {
                // Possible VS Code has closed its stream.
                try {
                    protocolMessageWriter.write(stdout, new TerminatedEvent());
                } catch { }
                terminatedEventSent = true;
            }
        });

        outputProtocolParser.once('event_terminated', () => {
            terminatedEventSent = true;
            dispose();
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
