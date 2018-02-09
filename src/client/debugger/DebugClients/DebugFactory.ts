import { DebugSession } from 'vscode-debugadapter';
import { AttachRequestArguments, LaunchRequestArguments } from '../Common/Contracts';
import { DebugClient } from './DebugClient';
import { DebuggerLauncherScriptProvider, DebuggerV2LauncherScriptProvider, NoDebugLauncherScriptProvider } from './launcherProvider';
import { LocalDebugClient } from './LocalDebugClient';
import { NonDebugClient } from './NonDebugClient';
import { RemoteDebugClient } from './RemoteDebugClient';

export function CreateLaunchDebugClient(launchRequestOptions: LaunchRequestArguments, debugSession: DebugSession, canLaunchTerminal: boolean): DebugClient<{}> {
    if (launchRequestOptions.noDebug === true) {
        return new NonDebugClient(launchRequestOptions, debugSession, canLaunchTerminal, new NoDebugLauncherScriptProvider());
    }
    const launchScriptProvider = launchRequestOptions.type === 'pythonExperimental' ? new DebuggerV2LauncherScriptProvider() : new DebuggerLauncherScriptProvider();
    return new LocalDebugClient(launchRequestOptions, debugSession, canLaunchTerminal, launchScriptProvider);
}
export function CreateAttachDebugClient(attachRequestOptions: AttachRequestArguments, debugSession: DebugSession): DebugClient<{}> {
    return new RemoteDebugClient(attachRequestOptions, debugSession);
}
