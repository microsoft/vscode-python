import { DebugSession } from 'vscode-debugadapter';
import { IPythonProcess, LaunchRequestArguments } from '../Common/Contracts';
import { BaseDebugServer } from './BaseDebugServer';
import { LocalDebugServer } from './LocalDebugServer';

export function CreateDebugServer(debugSession: DebugSession, pythonProcess: IPythonProcess | undefined, args: LaunchRequestArguments): BaseDebugServer {
    return new LocalDebugServer(debugSession, pythonProcess, args);
}
