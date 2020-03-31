// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as TypeMoq from 'typemoq';
import { AATesting } from '../../client/activation/aaTesting';
import { ValidateABTesting } from '../../client/common/experimentGroups';
import { IExperimentsManager } from '../../client/common/types';

suite('A/A Testing', () => {
    let experiments: TypeMoq.IMock<IExperimentsManager>;
    let aaTesting: AATesting;
    setup(() => {
        experiments = TypeMoq.Mock.ofType<IExperimentsManager>();
        aaTesting = new AATesting(experiments.object);
    });

    test('Send telemetry corresponding to the experiment user is in', async () => {
        experiments
            .setup((exp) => exp.sendTelemetryIfInExperiment(ValidateABTesting.experiment))
            .returns(() => undefined)
            .verifiable(TypeMoq.Times.once());
        experiments
            .setup((exp) => exp.sendTelemetryIfInExperiment(ValidateABTesting.control))
            .returns(() => undefined)
            .verifiable(TypeMoq.Times.once());
        await aaTesting.activate();
        experiments.verifyAll();
    });
});
