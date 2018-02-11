import { ChildProcess } from 'child_process';
import { DebugSession } from 'vscode-debugadapter';
import { LaunchRequestArguments } from '../Common/Contracts';
import { IDebugLauncherScriptProvider } from '../types';
import { DebugType } from './DebugClient';
import { LocalDebugClient } from './LocalDebugClient';

export class NonDebugClient extends LocalDebugClient {
    // tslint:disable-next-line:no-any
    constructor(args: LaunchRequestArguments, debugSession: DebugSession, canLaunchTerminal: boolean, launcherScriptProvider: IDebugLauncherScriptProvider) {
        super(args, debugSession, canLaunchTerminal, launcherScriptProvider);
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
}
