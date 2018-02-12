// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { IDebugLauncherScriptProvider } from '../types';

export class NoDebugLauncherScriptProvider implements IDebugLauncherScriptProvider {
    public getLauncherFilePath(): string {
        return path.join(path.dirname(__dirname), '..', '..', '..', 'pythonFiles', 'PythonTools', 'visualstudio_py_launcher_nodebug.py');
    }
}

export class DebuggerLauncherScriptProvider implements IDebugLauncherScriptProvider {
    public getLauncherFilePath(): string {
        return path.join(path.dirname(__dirname), '..', '..', '..', 'pythonFiles', 'PythonTools', 'visualstudio_py_launcher.py');
    }
}

export class DebuggerV2LauncherScriptProvider implements IDebugLauncherScriptProvider {
    public getLauncherFilePath(): string {
        return path.join(path.dirname(__dirname), '..', '..', '..', 'pythonFiles', 'experimental', 'ptvsd_launcher.py');
    }
}
