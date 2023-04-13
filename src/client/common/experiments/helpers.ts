// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IExperimentService } from '../types';
import { TerminalEnvVarActivation } from './groups';

export function inTerminalEnvVarExperiment(experimentService: IExperimentService): boolean {
    if (!experimentService.inExperimentSync(TerminalEnvVarActivation.experiment)) {
        return false;
    }
    return true;
}
