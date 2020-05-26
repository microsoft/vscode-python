// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ValidateABTesting } from '../common/experiments/groups';
import { IExperimentsManager } from '../common/types';
import { IExtensionSingleActivationService } from './types';

@injectable()
export class AATesting implements IExtensionSingleActivationService {
    constructor(@inject(IExperimentsManager) private experiments: IExperimentsManager) {}

    public async activate(): Promise<void> {
        this.experiments.sendTelemetryIfInExperiment(ValidateABTesting.experiment);
        this.experiments.sendTelemetryIfInExperiment(ValidateABTesting.control);
    }
}
