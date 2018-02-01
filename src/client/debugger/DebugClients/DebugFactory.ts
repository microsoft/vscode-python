import { DebugSession } from 'vscode-debugadapter';
import { AttachRequestArguments, LaunchRequestArguments } from '../Common/Contracts';
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
