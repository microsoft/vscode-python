import { ChildProcess, spawn } from 'child_process';
import * as fs from 'fs';
import * as net from 'net';
import * as path from 'path';
import { createDeferred } from '../../common/helpers';

/*
1. Start process
/Users/donjayamanne/anaconda3/envs/py36/bin/python -m ptvsd --port 8788 --file main.py
2. Start this debugger
*/
class Debugger {
    private ptvsdProc: ChildProcess;
    private pppProc: ChildProcess;
    public async start() {
        this.log('Started');
        // parse arguments
        let port = 0;
        const args = process.argv.slice(2);
        args.forEach((val, index, array) => {
            const portMatch = /^--server=(\d{4,5})$/.exec(val);
            if (portMatch) {
                port = parseInt(portMatch[1], 10);
            }
        });
        try {
            const connected = createDeferred<boolean>();
            const socket = net.connect({ port: 8788, host: 'localhost' }, () => {
                connected.resolve();
            });
            socket.on('error', ex => {
                this.log('\nSocket Error\n:');
                const x = '';
            });
            await connected.promise;

            // process.stdin.on('data', data => {
            //     socket.write(data);
            // });
            // socket.on('data', data => {
            //     process.stdout.write(data);
            // });

            process.stdin.pipe(socket);
            socket.pipe(process.stdout);

            process.stdin.resume();
        } catch (ex) {
            // tslint:disable-next-line:prefer-template
            this.log('\nCrap\n:' + ex.toString());
        }
    }
    private log(message) {
        const logFile = '/Users/donjayamanne/.vscode/extensions/pythonVSCodeDebugger/log2.log';
        fs.appendFileSync(logFile, `\n${message}\n`);
    }
    // private startPTVSD() {
    //     const program = '/Users/donjayamanne/Desktop/Development/vscode/ptvsdDebugger/main.py';
    //     const pythonPath = '/Users/donjayamanne/anaconda3/envs/py36/bin/python';
    //     const spawnArgs = ['-m', 'ptvsd', '--server', 'localhost', '--port', '8765', '--file', program];
    //     const cwd = path.dirname(program);
    //     this.ptvsdProc = spawn(pythonPath, spawnArgs, { cwd });
    // }
    // private startPpD() {
    //     const program = '/Users/donjayamanne/Desktop/Development/vscode/ptvsdDebugger/main.py';
    //     const pythonPath = '/Users/donjayamanne/anaconda3/envs/py36/bin/python';
    //     const spawnArgs = ['-m', 'ppdd', '--client', 'localhost', '--port', '5678', '--file', program];
    //     const cwd = path.dirname(program);
    //     // const options = { cwd, stdio: 'inherit' };
    //     const options = { cwd };
    //     this.pppProc = spawn(pythonPath, spawnArgs, options);
    // }
}

// tslint:disable-next-line:no-empty
new Debugger().start().catch(() => { });
