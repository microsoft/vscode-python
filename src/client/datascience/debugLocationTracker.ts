// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { injectable } from 'inversify';
import { DebugSession } from 'vscode';

import { IDebugLocationTracker } from './types';

@injectable()
export class DebugLocationTracker implements IDebugLocationTracker {
    public setDebugSession(targetSession: DebugSession) {
        let testing = 1;
        testing = 2;
    }

    public getDebugLocation(): number {
        return 1;
    }
}
