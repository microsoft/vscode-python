import * as child_process from 'child_process';
import * as path from 'path';
import { DebugSession, OutputEvent } from 'vscode-debugadapter';
import { IDebugServer, IPythonProcess, IPythonThread } from '../Common/Contracts';
import { AttachRequestArguments, DjangoApp, LaunchRequestArguments } from '../Common/Contracts';
import { BaseDebugServer } from '../DebugServers/BaseDebugServer';
import { LocalDebugServer } from '../DebugServers/LocalDebugServer';
import { DebugClient } from './DebugClient';
import { LocalDebugClient } from './LocalDebugClient';
import { NonDebugClient } from './NonDebugClient';
import { RemoteDebugClient } from './RemoteDebugClient';

export function CreateLaunchDebugClient(launchRequestOptions: LaunchRequestArguments, debugSession: DebugSession, canLaunchTerminal: boolean): DebugClient {
    if (launchRequestOptions.noDebug === true) {
        return new NonDebugClient(launchRequestOptions, debugSession, canLaunchTerminal);
    }
    return new LocalDebugClient(launchRequestOptions, debugSession, canLaunchTerminal);
}
export function CreateAttachDebugClient(attachRequestOptions: AttachRequestArguments, debugSession: DebugSession): DebugClient {
    return new RemoteDebugClient(attachRequestOptions, debugSession);
}
