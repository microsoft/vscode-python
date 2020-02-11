import { DebugSession } from 'vscode-debugadapter';
import { AttachRequestArguments, LaunchRequestArguments } from '../../types';
import { ILocalDebugLauncherScriptProvider } from '../types';
import { DebugClient } from './DebugClient';
import { DebuggerLauncherScriptProvider, NoDebugLauncherScriptProvider } from './launcherProvider';
import { LocalDebugClient } from './LocalDebugClient';
import { LocalDebugClientV2 } from './localDebugClientV2';
import { NonDebugClientV2 } from './nonDebugClientV2';
import { RemoteDebugClient } from './RemoteDebugClient';

export function CreateLaunchDebugClient(
    launchRequestOptions: LaunchRequestArguments,
    debugSession: DebugSession,
    canLaunchTerminal: boolean
): DebugClient<{}> {
    let launchScriptProvider: ILocalDebugLauncherScriptProvider;
    let debugClientClass: typeof LocalDebugClient;
    if (launchRequestOptions.noDebug === true) {
        launchScriptProvider = new NoDebugLauncherScriptProvider();
        debugClientClass = NonDebugClientV2;
    } else {
        launchScriptProvider = new DebuggerLauncherScriptProvider();
        debugClientClass = LocalDebugClientV2;
    }
    return new debugClientClass(launchRequestOptions, debugSession, canLaunchTerminal, launchScriptProvider);
}
export function CreateAttachDebugClient(
    attachRequestOptions: AttachRequestArguments,
    debugSession: DebugSession
): DebugClient<{}> {
    return new RemoteDebugClient(attachRequestOptions, debugSession);
}
