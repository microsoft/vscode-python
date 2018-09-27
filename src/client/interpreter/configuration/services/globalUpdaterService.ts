// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ConfigurationTarget } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import { IPythonPathUpdaterService } from '../types';
import { ScopedPythonPathUpdater } from './pythonPathUpdater';

export class GlobalPythonPathUpdaterService extends ScopedPythonPathUpdater implements IPythonPathUpdaterService {

    constructor(
        workspaceService: IWorkspaceService
    ) {
        super(
            ConfigurationTarget.Global,
            () => { return workspaceService.getConfiguration('python'); }
        );
    }
}
