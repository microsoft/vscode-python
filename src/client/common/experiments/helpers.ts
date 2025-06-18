// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { env, workspace } from 'vscode';
import { IExperimentService } from '../types';
import { EnvExtEnabled, TerminalEnvVarActivation } from './groups';
import { isTestExecution } from '../constants';
import { traceInfo } from '../../logging';
import { inExperiment } from '../../pythonEnvironments/common/externalDependencies';

export function inTerminalEnvVarExperiment(experimentService: IExperimentService): boolean {
    if (!isTestExecution() && env.remoteName && workspace.workspaceFolders && workspace.workspaceFolders.length > 1) {
        // TODO: Remove this if statement once https://github.com/microsoft/vscode/issues/180486 is fixed.
        traceInfo('Not enabling terminal env var experiment in multiroot remote workspaces');
        return false;
    }
    if (!experimentService.inExperimentSync(TerminalEnvVarActivation.experiment)) {
        return false;
    }
    return true;
}

export function inEnvExtEnabledExperiment(): boolean {
    return inExperiment(EnvExtEnabled.experiment);
}
