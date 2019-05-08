// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-classes-per-file

import * as path from 'path';
import { EXTENSION_ROOT_DIR } from '../../../common/constants';
import { IDebugLauncherScriptProvider, IRemoteDebugLauncherScriptProvider, LocalDebugOptions, RemoteDebugOptions } from '../types';

const pathToScript = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'ptvsd_launcher.py');
export class NoDebugLauncherScriptProvider implements IDebugLauncherScriptProvider<LocalDebugOptions> {
    public getLauncherArgs(options: LocalDebugOptions, script: string = pathToScript): string[] {
        const customDebugger = options.customDebugger ? '--custom' : '--default';
        return [script.fileToCommandArgument(), customDebugger, '--nodebug', '--client', '--host', options.host, '--port', options.port.toString()];
    }
}

export class DebuggerLauncherScriptProvider implements IDebugLauncherScriptProvider<LocalDebugOptions>  {
    public getLauncherArgs(options: LocalDebugOptions, script: string = pathToScript): string[] {
        const customDebugger = options.customDebugger ? '--custom' : '--default';
        return [script.fileToCommandArgument(), customDebugger, '--client', '--host', options.host, '--port', options.port.toString()];
    }
}

export class RemoteDebuggerLauncherScriptProvider implements IRemoteDebugLauncherScriptProvider {
    public getLauncherArgs(options: RemoteDebugOptions, script: string = pathToScript): string[] {
        const waitArgs = options.waitUntilDebuggerAttaches ? ['--wait'] : [];
        return [script.fileToCommandArgument(), '--default', '--host', options.host, '--port', options.port.toString()].concat(waitArgs);
    }
}
