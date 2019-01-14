// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Resource } from '../../common/types';

export const IEnvironmentActivationService = Symbol('IEnvironmentActivationService');
export interface IEnvironmentActivationService {
    getActivatedEnvironmentVariables(resource: Resource): Promise<NodeJS.ProcessEnv | undefined>;
}
