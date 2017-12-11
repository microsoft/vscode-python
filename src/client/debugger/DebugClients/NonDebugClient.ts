import { ChildProcess } from 'child_process';
import * as path from 'path';
import { DebugSession } from 'vscode-debugadapter';
import { LaunchRequestArguments } from '../Common/Contracts';
import { DebugType } from './DebugClient';
import { LocalDebugClient } from './LocalDebugClient';

export class NonDebugClient extends LocalDebugClient {
    // tslint:disable-next-line:no-any
    constructor(args: LaunchRequestArguments, debugSession: DebugSession, canLaunchTerminal: boolean) {
        super(args, debugSession, canLaunchTerminal);
    }

    public get DebugType(): DebugType {
        return DebugType.RunLocal;
    }

    public Stop() {
        super.Stop();
        if (this.pyProc) {
            try {
                this.pyProc!.kill();
                // tslint:disable-next-line:no-empty
            } catch { }
            this.pyProc = undefined;
        }
    }
    protected handleProcessOutput(proc: ChildProcess, _failedToLaunch: (error: Error | string | Buffer) => void) {
        this.pythonProcess.attach(proc);
    }
    protected getLauncherFilePath(): string {
        const currentFileName = module.filename;
        const ptVSToolsPath = path.join(path.dirname(currentFileName), '..', '..', '..', '..', 'pythonFiles', 'PythonTools');
        return path.join(ptVSToolsPath, 'visualstudio_py_launcher_nodebug.py');
    }
}
