"use strict";

import * as child_process from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import { SocketClient } from './socketClient';
import { SocketServer } from '../common/net/socket/socketServer';
import { createDeferred, Deferred } from '../common/helpers';
import { PythonSettings } from '../common/configSettings';
import { EventEmitter } from 'events';
import { CancellationToken } from 'vscode';
import { RequestCommands } from "./commands";

export enum Command {
    Completions,
    Definition,
    Hover,
    References,
    Signature,
    DocumentSymbols
}

const commandMapping = new Map<Command, Buffer>();
commandMapping.set(Command.Completions, RequestCommands.Completions);
commandMapping.set(Command.Definition, RequestCommands.Definitions);
commandMapping.set(Command.Hover, RequestCommands.Hover);
commandMapping.set(Command.References, RequestCommands.Usages);
commandMapping.set(Command.Signature, RequestCommands.Arguments);
commandMapping.set(Command.DocumentSymbols, RequestCommands.Names);

export class ClientAdapter extends EventEmitter {
    constructor(private outputChannel: vscode.OutputChannel, private rootDir: string) {
        super();
    }
    public getResult<T>(responseParser: (data: Object) => T, command: Command, token: CancellationToken, fileName: string, columnIndex?: number, lineIndex?: number, source?: string): Promise<T> {
        const cmd = commandMapping.get(command);
        return this.socketClient.getResult<any>(cmd, token, fileName, columnIndex, lineIndex, source)
            .then(responseParser);
    }
    private process: child_process.ChildProcess;
    private socketServer: SocketServer;
    private socketClient: SocketClient;

    private startDef: Deferred<any>;

    public dispose() {
        try {
            if (this.process) {
                this.process.stdin.write('\n');
            }
        }
        catch (ex) {
        }
        try {
            this.socketClient.dispose();
        }
        catch (ex) {
        }
        try {
            this.socketServer.Stop();
        }
        catch (ex) {
        }
        this.socketClient = null;
        this.process = null;
        this.socketServer = null;
        this.startDef = null;
    }
    public start(envVariables?: { [key: string]: string }): Promise<any> {
        if (this.startDef) {
            return this.startDef.promise;
        }

        this.startDef = createDeferred<any>();
        const pyFile = path.join(__dirname, '..', '..', '..', '..', 'pythonFiles', 'completionServer.py');
        const newEnv = {};
        Object.assign(newEnv, envVariables);
        Object.assign(newEnv, process.env);

        this.startSocketServer().then(port => {
            const def = createDeferred<any>();
            const options = { env: newEnv, cwd: this.rootDir };
            const rootDirUri = this.rootDir ? vscode.Uri.file(this.rootDir) : undefined;
            this.process = child_process.spawn(PythonSettings.getInstance(rootDirUri).pythonPath, [pyFile, port.toString()], options);
            this.process.stdout.setEncoding('utf8');
            this.process.stderr.setEncoding('utf8');

            let processStarted = false;
            let handshakeDone = false;

            this.process.stdout.on('data', (data: string) => {
                if (!processStarted && data.split(/\r?\n/g).some(line => line === 'Started')) {
                    processStarted = true;
                    if (processStarted && handshakeDone) {
                        def.resolve();
                    }
                    return;
                }
                this.outputChannel.append(data);
            });
            this.process.stderr.on('data', (data: string) => {
                this.outputChannel.append(data);
            });

            this.socketClient.on('handshake', () => {
                handshakeDone = true;
                if (processStarted && handshakeDone) {
                    def.resolve();
                }
            });

            return def.promise;
        }).then(() => {
            this.startDef.resolve();
        }).catch(reason => {
            this.startDef.reject(reason);
        });

        return this.startDef.promise;
    }
    private startSocketServer(): Promise<number> {
        this.socketServer = new SocketServer();
        this.socketClient = new SocketClient(this.socketServer, this.outputChannel);
        this.socketClient.on('status', status => {
            this.emit('status', status);
        });
        this.socketClient.on('error', error => {
            this.emit('error', error);
            console.error(error);
            this.outputChannel.appendLine('Error received: ' + error);
        });
        this.socketClient.on('commanderror', (commandError: { command: string, id: string, trace: string }) => {
            this.outputChannel.appendLine(`Unhandled command Error from Autocompletion Library. '${JSON.stringify(commandError)}'`);
        });
        return this.socketServer.Start();
    }
}
