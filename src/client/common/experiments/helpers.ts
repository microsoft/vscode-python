// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { workspace } from 'vscode';
import { IExperimentService } from '../types';
import { TerminalEnvVarActivation } from './groups';

export function inTerminalEnvVarExperiment(experimentService: IExperimentService): boolean {
    if (workspace.workspaceFile) {
        return false;
    }
    if (!experimentService.inExperimentSync(TerminalEnvVarActivation.experiment)) {
        // TODO: return false;
    }
    return true;
}
