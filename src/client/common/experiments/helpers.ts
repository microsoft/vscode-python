// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { env, workspace } from 'vscode';
import { IExperimentService } from '../types';
import { TerminalEnvVarActivation } from './groups';
import { isTestExecution } from '../constants';

export function inTerminalEnvVarExperiment(experimentService: IExperimentService): boolean {
    if (!isTestExecution() && workspace.workspaceFile && env.remoteName) {
        // TODO: Remove this if statement once https://github.com/microsoft/vscode/issues/180486 is fixed.
        return false;
    }
    if (!experimentService.inExperimentSync(TerminalEnvVarActivation.experiment)) {
        return false;
    }
    return true;
}
