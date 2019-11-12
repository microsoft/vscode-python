// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ChildProcess } from 'child_process';
import { DebugSession } from 'vscode-debugadapter';
import { LaunchRequestArguments } from '../../types';
import { ILocalDebugLauncherScriptProvider } from '../types';
import { DebugType } from './DebugClient';
import { LocalDebugClientV2 } from './localDebugClientV2';

export class NonDebugClientV2 extends LocalDebugClientV2 {
    constructor(args: LaunchRequestArguments, debugSession: DebugSession, canLaunchTerminal: boolean, launcherScriptProvider: ILocalDebugLauncherScriptProvider) {
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
            } catch {}
            this.pyProc = undefined;
        }
    }
    protected handleProcessOutput(_proc: ChildProcess, _failedToLaunch: (error: Error | string | Buffer) => void) {
        // Do nothing
    }
}
