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
import { DebugSession, Handles, InitializedEvent, OutputEvent, Scope, Source, StackFrame, StoppedEvent, TerminatedEvent, Thread, Variable } from 'vscode-debugadapter';
import { ThreadEvent } from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import { createDeferred } from '../../common/helpers';

export class PythonDebugger extends DebugSession {
    constructor(debuggerLinesAndColumnsStartAt1?: boolean, isServer?: boolean) {
        super(debuggerLinesAndColumnsStartAt1, isServer);
    }
    public static async run() {
        // // parse arguments
        // let port = 0;
        // const args = process.argv.slice(2);
        // args.forEach((val, index, array) => {
        //     const portMatch = /^--server=(\d{4,5})$/.exec(val);
        //     if (portMatch) {
        //         port = parseInt(portMatch[1], 10);
        //     }
        // });

        // if (port > 0) {
        //     // start as a server
        //     console.error(`waiting for debug protocol on port ${port}`);
        //     net.createServer((socket) => {
        //         console.error('>> accepted connection from client');
        //         socket.on('end', () => {
        //             console.error('>> client connection closed\n');
        //         });
        //         const session = new PythonDebugger(false, true);
        //         session.setRunAsServer(true);
        //         session.start(socket as NodeJS.ReadableStream, socket);
        //     }).listen(port);
        // } else {
        // start a session
        //console.error('waiting for debug protocol on stdin/stdout');


        // const session = new PythonDebugger(false);
        // process.on('SIGTERM', () => {
        //     session.shutdown();
        // });
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
            process.stdin.pipe(inStream);
            outStream.pipe(process.stdout);
            // session.start(inStream, outStream);
            PythonDebugger.log('Step 1');
            const connected = createDeferred<boolean>();
            const socket = net.connect({ port: 8789, host: 'localhost' }, () => {
                PythonDebugger.log('Resolved');
                connected.resolve();
            });
            PythonDebugger.log('Step 2');
            socket.on('error', ex => {
                PythonDebugger.log('\nSocket Error\n:');
                const x = '';
            });
            await connected.promise;

            // process.stdin.on('data', data => {
            //     socket.write(data);
            // });
            // socket.on('data', data => {
            //     process.stdout.write(data);
            // });

            inStream.pipe(socket);
            socket.pipe(outStream);

            process.stdin.resume();
        } catch (ex) {
            // tslint:disable-next-line:prefer-template
            PythonDebugger.log('\nCrap\n:' + ex.toString());
        }

    }
    public static log(message: string) {
        const logFile = '/Users/donjayamanne/.vscode/extensions/pythonVSCode/log2.log';
        fs.appendFileSync(logFile, `\n${message}\n`);
    }
    // public start(inStream: NodeJS.ReadableStream, outStream: NodeJS.WritableStream): void {
    //     inStream.on('data', (data: Buffer) => this._handleData(data));

    //     inStream.on('close', () => {
    //         this._emitEvent(new Event('close'));
    //     });
    //     inStream.on('error', (error) => {
    //         this._emitEvent(new Event('error', 'inStream error: ' + (error && error.message)));
    //     });

    //     outStream.on('error', (error) => {
    //         this._emitEvent(new Event('error', 'outStream error: ' + (error && error.message)));
    //     });

    //     inStream.resume();
    // }

}

// class OutputStreamWrapper extends Transform {
//     // tslint:disable-next-line:no-any
//     public _transform(chunk: any, encoding: string, callback: Function): void {
//         callback(null, chunk);
//     }
// }

PythonDebugger.run();
