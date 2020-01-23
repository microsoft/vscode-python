// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IExtensionSingleActivationService } from '../../activation/types';
import '../../common/extensions';
import { IEnvironmentActivationService } from './types';

@injectable()
export class PreWarmActivatedEnvironmentVariables implements IExtensionSingleActivationService {
    constructor(@inject(IEnvironmentActivationService) private readonly activationService: IEnvironmentActivationService) {}
    public async activate(): Promise<void> {
        this.activationService.getActivatedEnvironmentVariables(undefined).ignoreErrors();
    }
}
