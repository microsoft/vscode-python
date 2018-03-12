// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { injectable } from 'inversify';
import { debug, DebugConfiguration, WorkspaceFolder } from 'vscode';
import { IDebugService } from './types';

@injectable()
export class DebugService implements IDebugService {
    public startDebugging(folder: WorkspaceFolder | undefined, nameOrConfiguration: string | DebugConfiguration): Thenable<boolean> {
        return debug.startDebugging(folder, nameOrConfiguration);
    }
}
