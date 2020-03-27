// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { DebugSession } from 'vscode-debugadapter';
import { LaunchRequestArguments } from '../../types';
import { ILocalDebugLauncherScriptProvider } from '../types';
import { LocalDebugClient } from './LocalDebugClient';

export class LocalDebugClientV2 extends LocalDebugClient {
    constructor(
        args: LaunchRequestArguments,
        debugSession: DebugSession,
        canLaunchTerminal: boolean,
        launcherScriptProvider: ILocalDebugLauncherScriptProvider
    ) {
        super(args, debugSession, canLaunchTerminal, launcherScriptProvider);
    }
    protected buildDebugArguments(_cwd: string, debugPort: number): string[] {
        return this.launcherScriptProvider.getLauncherArgs({
            host: 'localhost',
            port: debugPort,
            customDebugger: this.args.customDebugger,
        });
    }
    protected buildStandardArguments() {
        const programArgs = Array.isArray(this.args.args) && this.args.args.length > 0 ? this.args.args : [];
        if (typeof this.args.module === 'string' && this.args.module.length > 0) {
            return ['-m', this.args.module, ...programArgs];
        }
        if (this.args.program && this.args.program.length > 0) {
            return [this.args.program, ...programArgs];
        }
        return programArgs;
    }
}
