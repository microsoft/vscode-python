// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Resource } from '../../common/types';
import { PythonInterpreter } from '../../pythonEnvironments/info';

export const IEnvironmentActivationService = Symbol('IEnvironmentActivationService');
export interface IEnvironmentActivationService {
    getActivatedEnvironmentVariables(
        resource: Resource,
        interpreter?: PythonInterpreter,
        allowExceptions?: boolean
    ): Promise<NodeJS.ProcessEnv | undefined>;
}
