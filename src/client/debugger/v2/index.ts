'use strict';

// This line should always be right on top.
// tslint:disable-next-line:no-any
if ((Reflect as any).metadata === undefined) {
    // tslint:disable-next-line:no-require-imports no-var-requires
    require('reflect-metadata');
}

import * as fs from 'fs';
import { ReadableStream } from 'memory-streams';
import * as net from 'net';
import * as path from 'path';
import { Readable, ReadableOptions, Transform, Writable } from 'stream';
import * as url from 'url';
import { DebugSession, Handles, InitializedEvent, logger, LoggingDebugSession, OutputEvent, Scope, Source, StackFrame, StoppedEvent, TerminatedEvent, Thread, Variable, Response, ErrorDestination } from 'vscode-debugadapter';
import { ThreadEvent } from 'vscode-debugadapter';
import { LogLevel } from 'vscode-debugadapter/lib/logger';
import { ProtocolServer } from 'vscode-debugadapter/lib/protocol';
import { DebugProtocol } from 'vscode-debugprotocol';
import { createDeferred } from '../../common/helpers';
import { LaunchRequestArguments } from '../Common/Contracts';
import { DebugProtocolServer } from './protocol';

export class PythonDebugger extends LoggingDebugSession {
    public connected: Promise<void>;
    public isConnected: boolean;
    // protected _isServer: boolean;
    private connectedDeferred = createDeferred<void>();
    constructor(private readonly inStream: Transform,
        private readonly outStream: Transform,
        private readonly inSocketStream: net.Socket,
        private readonly outSocketStream: net.Socket,
        debuggerLinesAndColumnsStartAt1?: boolean, isServer?: boolean) {
        // super();
        super(path.join(__dirname, '..', '..', '..', '..', 'expDebug.log'), debuggerLinesAndColumnsStartAt1, isServer);
        this.connected = this.connectedDeferred.promise;
        // this._isServer = isServer;
    }
    public static async run() {
        try {
            const outStream = new Transform({
                transform(chunk, encoding, callback) {
                    callback(null, chunk);
                }
            });
            const inStream = new Transform({
                transform(chunk, encoding, callback) {
                    callback(null, chunk);
                }
            });
            const throughOutStream = new Transform({
                transform(chunk, encoding, callback) {
                    PythonDebugger.logProtocolMessages('Output\n');
                    PythonDebugger.logProtocolMessages(`${chunk.toString()}\n`);
                    callback(null, chunk);
                }
            });
            const throughInStream = new Transform({
                transform(chunk, encoding, callback) {
                    PythonDebugger.logProtocolMessages('Input\n');
                    PythonDebugger.logProtocolMessages(`${chunk.toString()}\n`);
                    callback(null, chunk);
                }
            });

            throughOutStream.pipe(process.stdout);
            // process.stdin.pipe(inStream);
            outStream.pipe(throughOutStream);
            // throughOutStream.pipe(process.stdout);
            // session.start(inStream, outStream);

            // Connect to the ptvsd debugger.
            const connected = createDeferred<boolean>();
            const socket = net.connect({ port: 8788, host: 'localhost' }, () => {
                connected.resolve();
            });

            socket.on('error', ex => {
                PythonDebugger.log('Socket Error\n:');
                PythonDebugger.log(ex.name);
                PythonDebugger.log(ex.message);
                PythonDebugger.log(ex.stack);
                PythonDebugger.log(ex.toString());
                const x = '';
            });

            await connected.promise;

            // Lets start our debugger
            const session = new PythonDebugger(inStream, outStream, socket, socket, false, true);

            socket.on('data', (data) => {
                PythonDebugger.log('Output from socket\n');
                PythonDebugger.log(`${data.toString()}\n`);
                // process.stdout.write(data);
                throughOutStream.write(data);
            });

            // process.stdin.pipe(throughInStream);
            process.stdin.on('data', (data) => {
                throughInStream.write(data);

                PythonDebugger.log(`From stdin ${session.isConnected}\n`);
                PythonDebugger.log(`${data.toString()}\n`);
                if (session.isConnected) {
                    PythonDebugger.log('Writing to socket\n');
                    socket.write(data);
                } else {
                    PythonDebugger.log('Writing to proxy debugger\n');
                    inStream.write(data);
                }
                PythonDebugger.log(`\n${'-'.repeat(100)}\n`);
            });

            session.setRunAsServer(true);
            session.start(inStream, outStream);

            process.stdin.resume();
            PythonDebugger.log('Started\n');
        } catch (ex) {
            // tslint:disable-next-line:prefer-template
            PythonDebugger.log(`\nCrap:${ex.toString()}`);
        }
    }
    public static log(message: string) {
        const logFile = '/Users/donjayamanne/.vscode/extensions/pythonVSCodeDebugger/log2.log';
        fs.appendFileSync(logFile, message);
    }
    public static logProtocolMessages(message: string) {
        const logFile = '/Users/donjayamanne/.vscode/extensions/pythonVSCodeDebugger/protocolMessages.log';
        fs.appendFileSync(logFile, message);
    }
    // tslint:disable-next-line:no-unnecessary-override
    public start(inStream: NodeJS.ReadableStream, outStream: NodeJS.WritableStream): void {
        super.start(inStream, outStream);
        // logger.setup(LogLevel.Verbose, true);
    }
    protected launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments): void {
        this.sendResponse(response);
        this.sendEvent(new InitializedEvent());

        this.isConnected = true;
        this.connectedDeferred.resolve();

        // process.stdin.unpipe(this.inStream);
        // process.stdin.pipe(this.inSocketStream);

        // this.outStream.unpipe(process.stdout);
        // this.outSocketStream.pipe(process.stdout);

        PythonDebugger.log('changed piping\n');
    }

    protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
        response.body!.supportsEvaluateForHovers = true;
        response.body!.supportsConditionalBreakpoints = true;
        response.body!.supportsConfigurationDoneRequest = true;
        response.body!.supportsEvaluateForHovers = false;
        response.body!.supportsFunctionBreakpoints = false;
        response.body!.supportsSetVariable = true;

        this.sendResponse(response);
    }
    protected attachRequest(response: DebugProtocol.AttachResponse, args: DebugProtocol.AttachRequestArguments): void {
        this.sendResponse(response);
    }
}

PythonDebugger.run();
