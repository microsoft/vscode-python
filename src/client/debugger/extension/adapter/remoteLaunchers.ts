// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import { EXTENSION_ROOT_DIR } from '../../../common/constants';
import '../../../common/extensions';

const pathToPythonLibDir = path.join(EXTENSION_ROOT_DIR, 'python_files', 'lib', 'python');
const pathToDebugger = path.join(pathToPythonLibDir, 'debugpy');

type RemoteDebugOptions = {
    host: string;
    port: number;
    waitUntilDebuggerAttaches: boolean;
};

export function getDebugpyLauncherArgs(options: RemoteDebugOptions, debuggerPath: string = pathToDebugger) {
    const waitArgs = options.waitUntilDebuggerAttaches ? ['--wait-for-client'] : [];
    return [
        debuggerPath.fileToCommandArgumentForPythonExt(),
        '--listen',
        `${options.host}:${options.port}`,
        ...waitArgs,
    ];
}

export function getDebugpyPackagePath(): string {
    return pathToDebugger;
}
