// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-classes-per-file

import * as path from 'path';
import { EXTENSION_ROOT_DIR } from '../../../common/constants';
import { IDebugLauncherScriptProvider, IRemoteDebugLauncherScriptProvider, LocalDebugOptions, RemoteDebugOptions } from '../types';

const script = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'experimental', 'ptvsd_launcher.py');
export class NoDebugLauncherScriptProvider implements IDebugLauncherScriptProvider<LocalDebugOptions> {
    public getLauncherArgs(options: LocalDebugOptions): string[] {
        const customDebugger = options.customDebugger ? '--custom' : '--default';
        return [script, customDebugger, '--nodebug', '--client', '--host', options.host, '--port', options.port.toString()];
    }
}

export class DebuggerLauncherScriptProvider implements IDebugLauncherScriptProvider<LocalDebugOptions>  {
    public getLauncherArgs(options: LocalDebugOptions): string[] {
        const customDebugger = options.customDebugger ? '--custom' : '--default';
        return [script, customDebugger, '--client', '--host', options.host, '--port', options.port.toString()];
    }
}

export class RemoteDebuggerLauncherScriptProvider implements IRemoteDebugLauncherScriptProvider {
    public getLauncherArgs(options: RemoteDebugOptions): string[] {
        const waitArgs = options.waitUntilDebuggerAttaches ? ['--wait'] : [];
        return [script, '--default', '--host', options.host, '--port', options.port.toString()].concat(waitArgs);
    }
}
