import * as path from 'path';
import * as ch from 'child_process';
import * as rpc from 'vscode-jsonrpc/node';
import { Disposable, window } from 'vscode';
import { EXTENSION_ROOT_DIR } from '../constants';
import { traceError, traceLog } from '../logging';

const SERVER_PATH = path.join(EXTENSION_ROOT_DIR, 'python_files', 'python_server.py');
let serverInstance: PythonServer | undefined;

export interface PythonServer extends Disposable {
    execute(code: string): Promise<string>;
    interrupt(): void;
    input(): void;
    checkValidCommand(code: string): Promise<boolean>;
}

class PythonServerImpl implements Disposable {
    private readonly disposables: Disposable[] = [];

    constructor(private connection: rpc.MessageConnection, private pythonServer: ch.ChildProcess) {
        this.initialize();
        this.input();
    }

    private initialize(): void {
        this.disposables.push(
            this.connection.onNotification('log', (message: string) => {
                console.log('Log:', message);
            }),
        );
        this.connection.listen();
    }

    public input(): void {
        // Register input request handler
        this.connection.onRequest('input', async (request) => {
            // Ask for user input via popup quick input, send it back to Python
            let userPrompt = 'Enter your input here: ';
            if (request && request.prompt) {
                userPrompt = request.prompt;
            }
            const input = await window.showInputBox({
                title: 'Input Request',
                prompt: userPrompt,
                ignoreFocusOut: true,
            });
            return { userInput: input };
        });
    }

    public execute(code: string): Promise<string> {
        return this.connection.sendRequest('execute', code);
    }

    public interrupt(): void {
        // Passing SIGINT to interrupt only would work for Mac and Linux
        if (this.pythonServer.kill('SIGINT')) {
            traceLog('Python REPL server interrupted');
        }
    }

    public async checkValidCommand(code: string): Promise<boolean> {
        const completeCode = await this.connection.sendRequest('check_valid_command', code);
        if (completeCode === 'True') {
            return new Promise((resolve) => resolve(true));
        }
        return new Promise((resolve) => resolve(false));
    }

    public dispose(): void {
        this.connection.sendNotification('exit');
        this.disposables.forEach((d) => d.dispose());
        this.connection.dispose();
    }
}

export function createPythonServer(interpreter: string[]): PythonServer {
    if (serverInstance) {
        return serverInstance;
    }

    const pythonServer = ch.spawn(interpreter[0], [...interpreter.slice(1), SERVER_PATH]);

    pythonServer.stderr.on('data', (data) => {
        traceError(data.toString());
    });
    pythonServer.on('exit', (code) => {
        traceError(`Python server exited with code ${code}`);
    });
    pythonServer.on('error', (err) => {
        traceError(err);
    });
    const connection = rpc.createMessageConnection(
        new rpc.StreamMessageReader(pythonServer.stdout),
        new rpc.StreamMessageWriter(pythonServer.stdin),
    );
    serverInstance = new PythonServerImpl(connection, pythonServer);
    return serverInstance;
}
