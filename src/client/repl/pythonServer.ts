import * as path from 'path';
import * as ch from 'child_process';
import * as rpc from 'vscode-jsonrpc/node';
import { Disposable } from 'vscode';
import { EXTENSION_ROOT_DIR } from '../constants';

// const SERVER_PATH = path.join(__dirname, '...', 'python_files', 'python_server.py');
const SERVER_PATH = path.join(EXTENSION_ROOT_DIR, 'python_files', 'python_server.py');

// const SERVER_PATH = path.join(__dirname, '..', '..', '..', 'pythonFiles', 'python_server.py');

export interface PythonServer extends Disposable {
    execute(code: string): Promise<string>;
    interrupt(): Promise<void>;
}

class PythonServerImpl implements Disposable {
    constructor(private connection: rpc.MessageConnection) {
        this.initialize();
    }

    private initialize(): void {
        this.connection.onNotification('log', (message: string) => {
            console.log('Log:', message);
        });
        this.connection.listen();
    }

    public execute(code: string): Promise<string> {
        return this.connection.sendRequest('execute', code);
    }

    public interrupt(): Promise<void> {
        // return this.connection.sendRequest('interrupt', 'interrupt');
        // pythonServer.kill('SIGINT');
        return this.connection.sendRequest('interrupt', 'blah');
    }

    public dispose(): void {
        this.connection.sendNotification('exit');
        this.connection.dispose();
    }
}

export function createPythonServer(interpreter: string[]): PythonServer {
    const pythonServer = ch.spawn(interpreter[0], [...interpreter.slice(1), SERVER_PATH]);

    pythonServer.stderr.on('data', (data) => {
        console.error(data.toString());
    });
    pythonServer.on('exit', (code) => {
        console.error(`Python server exited with code ${code}`);
    });
    pythonServer.on('error', (err) => {
        console.error(err);
    });
    const connection = rpc.createMessageConnection(
        new rpc.StreamMessageReader(pythonServer.stdout),
        new rpc.StreamMessageWriter(pythonServer.stdin),
    );
    return new PythonServerImpl(connection);
}
