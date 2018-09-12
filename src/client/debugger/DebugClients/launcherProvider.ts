// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-classes-per-file

import * as path from 'path';
import { IDebugLauncherScriptProvider } from '../types';

export class NoDebugLauncherScriptProvider implements IDebugLauncherScriptProvider {
    public getLauncherFilePath(): string {
        return path.join(path.dirname(__dirname), '..', '..', '..', 'pythonFiles', 'experimental', 'ptvsd_launcher.py');
    }
}

export class DebuggerLauncherScriptProvider implements IDebugLauncherScriptProvider {
    public getLauncherFilePath(): string {
        return path.join(path.dirname(__dirname), '..', '..', '..', 'pythonFiles', 'experimental', 'ptvsd_launcher.py');
    }
}
