// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { workspace } from 'vscode';
import { isTestExecution } from '../constants';
import { IExperimentService } from '../types';
import { TerminalEnvVarActivation } from './groups';

export function inTerminalEnvVarExperiment(experimentService: IExperimentService): boolean {
    if (workspace.workspaceFile && !isTestExecution()) {
        // Don't run experiment in multi-root workspaces for now, requires work on VSCode:
        // https://github.com/microsoft/vscode/issues/171173
        return false;
    }
    if (!experimentService.inExperimentSync(TerminalEnvVarActivation.experiment)) {
        return false;
    }
    return true;
}
