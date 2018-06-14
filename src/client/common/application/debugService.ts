// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { injectable } from 'inversify';
import { debug, DebugConfiguration, DebugSession, Event, WorkspaceFolder } from 'vscode';
import { IDebugService } from './types';

@injectable()
export class DebugService implements IDebugService {
    public get onDidStartDebugSession(): Event<DebugSession>{
        return debug.onDidStartDebugSession;
    }
    public startDebugging(folder: WorkspaceFolder | undefined, nameOrConfiguration: string | DebugConfiguration): Thenable<boolean> {
        return debug.startDebugging(folder, nameOrConfiguration);
    }
}
