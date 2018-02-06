'use strict';

// This line should always be right on top.
// tslint:disable-next-line:no-any
if ((Reflect as any).metadata === undefined) {
    // tslint:disable-next-line:no-require-imports no-var-requires
    require('reflect-metadata');
}

import * as fs from 'fs';
import * as net from 'net';
import * as path from 'path';
import { PassThrough, Readable, ReadableOptions, Transform, Writable } from 'stream';
import * as url from 'url';
import { DebugSession, ErrorDestination, Handles, InitializedEvent, logger, LoggingDebugSession, OutputEvent, Response, Scope, Source, StackFrame, StoppedEvent, TerminatedEvent, Thread, Variable } from 'vscode-debugadapter';
import { ThreadEvent } from 'vscode-debugadapter';
import { LogLevel } from 'vscode-debugadapter/lib/logger';
import { Message } from 'vscode-debugadapter/lib/messages';
import { ProtocolServer } from 'vscode-debugadapter/lib/protocol';
import { DebugProtocol } from 'vscode-debugprotocol';
import { createDeferred, Deferred } from '../../common/helpers';
import { LaunchRequestArguments } from '../Common/Contracts';
// import { DebugProtocolServer } from './protocol';

class InitializeRequest extends Message implements DebugProtocol.InitializeRequest {
    // tslint:disable-next-line:no-banned-terms
    public arguments: DebugProtocol.InitializeRequestArguments;
    public command: string;
    constructor(args: DebugProtocol.InitializeRequestArguments) {
        super('request');
        this.arguments = args;
        this.command = 'initialize';
    }
}

export class PythonDebugger extends LoggingDebugSession {
    constructor(private readonly inStream: Transform,
        private readonly outStream: Transform,
        private readonly inSocketStream: net.Socket,
        private readonly outSocketStream: net.Socket,
        debuggerLinesAndColumnsStartAt1?: boolean, isServer?: boolean) {
        // super();
        super(path.join(__dirname, '..', '..', '..', '..', 'expDebug.log'), debuggerLinesAndColumnsStartAt1, isServer);
    }
    // tslint:disable-next-line:max-func-body-length
    public static async run() {
        try {
            const debugOutStream = new PassThrough();
            const debugInStream = new PassThrough();

            const throughOutStream = new Transform({
                transform(chunk, encoding, callback) {
                    PythonDebugger.logProtocolMessages('Output\n');
                    PythonDebugger.logProtocolMessages(`${chunk.toString()}\n`);
                    callback(null, chunk);

                    if (chunk.toString().indexOf('"event": "terminated", "body": {}}') > 0) {
                        PythonDebugger.server.close();
                        throughOutStream.unpipe(process.stdout);
                        debuggerSocket.unpipe(throughOutStream);
                        // wait a bit before shutting down
                        setTimeout(() => {
                            process.exit(0);
                        }, 100);
                    }
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
            debugOutStream.pipe(throughOutStream);
            // throughOutStream.pipe(process.stdout);
            // session.start(inStream, outStream);

            // Connect to the ptvsd debugger.
            const port = await PythonDebugger.startSocketServer({ port: 8788 });
            const debuggerSocket = await PythonDebugger.clientSocket.promise;

            debuggerSocket.on('error', ex => {
                PythonDebugger.log('Socket Error\n:');
                PythonDebugger.log(ex.name);
                PythonDebugger.log(ex.message);
                PythonDebugger.log(ex.stack || '');
                PythonDebugger.log(ex.toString());
                const x = '';
            });

            // Lets start our debugger
            const session = new PythonDebugger(debugInStream, debugOutStream, debuggerSocket, debuggerSocket, false, true);

            session.on('_py_pause_input', () => {
                throughInStream.pause();
                process.stdin.pause();
                throughInStream.unpipe(debugInStream);
            });

            let initializedResopnse: string = '';
            session.on('_py_debug_initialize', (request: InitializeRequest) => {
                // PythonDebugger.logProtocolMessages('_py_pause_input\n');
                const json = JSON.stringify(request);
                // PythonDebugger.logProtocolMessages(`${json}\n`);
                const message = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`;
                // PythonDebugger.logProtocolMessages('Request for Socket\n');
                // PythonDebugger.logProtocolMessages(`${message}\n`);
                debuggerSocket.write(message, 'utf8');
                let collectedData = new Buffer(0);
                function onData(data: Buffer) {
                    collectedData = Buffer.concat([collectedData, data]);
                    const collectedDataStr = collectedData.toString('utf8');
                    const startIndex = collectedDataStr.indexOf('}Content-Length');
                    if (startIndex > 0) {
                        try {
                            initializedResopnse = collectedDataStr.substring(startIndex + 1);
                            PythonDebugger.logProtocolMessages('We\re done with socket initialization\n');
                            PythonDebugger.logProtocolMessages(`${initializedResopnse}\n`);
                            debuggerSocket.removeListener('data', onData);
                            session.emit('_py_debug_connect');
                        } catch (ex) {
                            PythonDebugger.logProtocolMessages('Ooops\n');
                            PythonDebugger.logProtocolMessages(ex.name);
                            PythonDebugger.logProtocolMessages(ex.message);
                            PythonDebugger.logProtocolMessages(ex.stack);
                            PythonDebugger.logProtocolMessages(ex.toString());
                        }
                    }
                }
                debuggerSocket.addListener('data', onData);
            });

            session.on('_py_debug_connect', () => {
                PythonDebugger.log('changed piping\n');
                // Send the initialized response
                throughOutStream.write(initializedResopnse);

                throughInStream.pipe(debuggerSocket);

                throughInStream.resume();
                process.stdin.resume();

                debugOutStream.unpipe(throughOutStream);
                debuggerSocket.pipe(throughOutStream);
            });

            // await connected.promise;

            process.stdin.pipe(throughInStream);
            throughInStream.pipe(debugInStream);

            session.setRunAsServer(true);
            session.start(debugInStream, debugOutStream);

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
    protected launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments): void {
        this.emit('_py_pause_input');

        this.sendResponse(response);

        const request = new InitializeRequest(this.initializeRequestArgs);
        request.seq = 1;
        this.emit('_py_debug_initialize', request);
        // this.sendEvent(new InitializedEvent());
        // setTimeout(() => {
        //     PythonDebugger.log('changed piping\n');
        //     this.emit('_py_debug_connect');
        // }, 5000);
    }
    // tslint:disable-next-line:member-ordering
    private initializeRequestArgs: DebugProtocol.InitializeRequestArguments;
    protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
        this.initializeRequestArgs = args;
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
    // tslint:disable-next-line:member-ordering
    public static server: net.Server;
    // tslint:disable-next-line:member-ordering
    public static clientSocket: Deferred<net.Socket> = createDeferred<net.Socket>();
    // tslint:disable-next-line:member-ordering
    public static startSocketServer(options: { port?: number, host?: string } = { port: 0, host: 'localhost' }): Promise<number> {
        const startedDef = createDeferred<number>();
        const server = PythonDebugger.server = net.createServer(PythonDebugger.clientSocket.resolve.bind(PythonDebugger.clientSocket));
        server.on('error', (err) => {
            if (startedDef.completed) {
                startedDef.reject(err);
            }
        });
        options.port = typeof options.port === 'number' ? options.port! : 0;
        options.host = typeof options.host === 'string' && options.host!.trim().length > 0 ? options.host!.trim() : 'localhost';
        server.listen(options, (socket: net.Socket) => {
            startedDef.resolve(server.address().port);
        });
        return startedDef.promise;
    }
}

PythonDebugger.run();
