import * as path from 'path';
import { DebugSession, OutputEvent } from 'vscode-debugadapter';
import { IPythonProcess } from '../Common/Contracts';
import { LaunchRequestArguments } from '../Common/Contracts';
import { BaseDebugServer } from '../DebugServers/BaseDebugServer';
import { LocalDebugServer } from '../DebugServers/LocalDebugServer';
import { DebugType } from './DebugClient';
import { LocalDebugClient } from './LocalDebugClient';

export class NonDebugClient extends LocalDebugClient {
    protected args: LaunchRequestArguments;
    // tslint:disable-next-line:no-any
    constructor(args: LaunchRequestArguments, debugSession: DebugSession) {
        super(args, debugSession);
        this.args = args;
    }

    public CreateDebugServer(pythonProcess: IPythonProcess): BaseDebugServer {
        return this.debugServer = new LocalDebugServer(this.debugSession, pythonProcess);
    }

    public get DebugType(): DebugType {
        return DebugType.RunLocal;
    }

    public Stop() {
        super.Stop();
        if (this.pyProc) {
            try {
                this.pyProc.kill();
                // tslint:disable-next-line:no-empty
            } catch { }
            this.pyProc = null;
        }
    }
    protected handleProcessOutput(_failedToLaunch: (error: Error | string | Buffer) => void) {
        this.pyProc.on('error', error => {
            this.debugSession.sendEvent(new OutputEvent(error.toString(), 'stderr'));
        });
        this.pyProc.stderr.setEncoding('utf8');
        this.pyProc.stdout.setEncoding('utf8');
        this.pyProc.stderr.on('data', (error: string) => {
            this.debugSession.sendEvent(new OutputEvent(error, 'stderr'));
        });
        this.pyProc.stdout.on('data', (d: string) => {
            this.debugSession.sendEvent(new OutputEvent(d, 'stdout'));
        });
        this.pyProc.on('exit', () => {
            this.pyProc = null;
            this.emit('detach');
        });
    }
    protected getLauncherFilePath(): string {
        const currentFileName = module.filename;
        const ptVSToolsPath = path.join(path.dirname(currentFileName), '..', '..', '..', '..', 'pythonFiles', 'PythonTools');
        return path.join(ptVSToolsPath, 'visualstudio_py_launcher_nodebug.py');
    }
}
