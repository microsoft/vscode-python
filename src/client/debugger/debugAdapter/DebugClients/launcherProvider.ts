// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-classes-per-file

import { optional } from 'inversify';
import * as path from 'path';
import { EXTENSION_ROOT_DIR } from '../../../common/constants';
import { IDebugLauncherScriptProvider, LocalDebugOptions } from '../types';

const pathToScript = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'ptvsd_launcher.py');

export class NoDebugLauncherScriptProvider implements IDebugLauncherScriptProvider<LocalDebugOptions> {
    constructor(@optional() private script: string = pathToScript) {}
    public getLauncherArgs(options: LocalDebugOptions): string[] {
        const customDebugger = options.customDebugger ? '--custom' : '--default';
        return [
            this.script,
            customDebugger,
            '--nodebug',
            '--client',
            '--host',
            options.host,
            '--port',
            options.port.toString()
        ];
    }
}

export class DebuggerLauncherScriptProvider implements IDebugLauncherScriptProvider<LocalDebugOptions> {
    constructor(@optional() private script: string = pathToScript) {}
    public getLauncherArgs(options: LocalDebugOptions): string[] {
        const customDebugger = options.customDebugger ? '--custom' : '--default';
        return [this.script, customDebugger, '--client', '--host', options.host, '--port', options.port.toString()];
    }
}
