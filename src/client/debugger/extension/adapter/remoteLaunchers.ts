// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import { EXTENSION_ROOT_DIR } from '../../../common/constants';
import '../../../common/extensions';

const pathToPythonLibDir = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'lib', 'python');
const pathToScript = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'ptvsd_launcher.py');
const pathToDebugger = path.join(pathToPythonLibDir, 'debugpy');

export type RemoteDebugOptions = {
    host: string;
    port: number;
    waitUntilDebuggerAttaches: boolean;
};

export function getPtvsdLauncherScriptArgs(options: RemoteDebugOptions, script: string = pathToScript): string[] {
    const waitArgs = options.waitUntilDebuggerAttaches ? ['--wait'] : [];
    return [
        script.fileToCommandArgument(),
        '--default',
        '--host',
        options.host,
        '--port',
        options.port.toString(),
        ...waitArgs
    ];
}

export function getDebugpyLauncherArgs(options: RemoteDebugOptions, debuggerPath: string = pathToDebugger) {
    const waitArgs = options.waitUntilDebuggerAttaches ? ['--wait-for-client'] : [];
    return [debuggerPath.fileToCommandArgument(), '--listen', `${options.host}:${options.port}`, ...waitArgs];
}

export function getDebugpyPackagePath(): string {
    return pathToDebugger;
}
