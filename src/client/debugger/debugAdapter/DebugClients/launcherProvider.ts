// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-classes-per-file

import { optional } from 'inversify';
import * as path from 'path';
import { EXTENSION_ROOT_DIR } from '../../../common/constants';
import { IDebugLauncherScriptProvider, IRemoteDebugLauncherScriptProvider, LocalDebugOptions, RemoteDebugOptions } from '../types';

const pathToScript = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'ptvsd_launcher.py');
export class NoDebugLauncherScriptProvider implements IDebugLauncherScriptProvider<LocalDebugOptions> {
    constructor(@optional() private script: string = pathToScript) { }
    public getLauncherArgs(options: LocalDebugOptions): string[] {
        const customDebugger = options.customDebugger ? '--custom' : '--default';
        return [this.script.fileToCommandArgument(), customDebugger, '--nodebug', '--client', '--host', options.host, '--port', options.port.toString()];
    }
}

export class DebuggerLauncherScriptProvider implements IDebugLauncherScriptProvider<LocalDebugOptions>  {
    constructor(@optional() private script: string = pathToScript) { }
    public getLauncherArgs(options: LocalDebugOptions): string[] {
        const customDebugger = options.customDebugger ? '--custom' : '--default';
        return [this.script.fileToCommandArgument(), customDebugger, '--client', '--host', options.host, '--port', options.port.toString()];
    }
}

export class RemoteDebuggerLauncherScriptProvider implements IRemoteDebugLauncherScriptProvider {
    constructor(@optional() private script: string = pathToScript) { }
    public getLauncherArgs(options: RemoteDebugOptions): string[] {
        const waitArgs = options.waitUntilDebuggerAttaches ? ['--wait'] : [];
        return [this.script.fileToCommandArgument(), '--default', '--host', options.host, '--port', options.port.toString()].concat(waitArgs);
    }
}
