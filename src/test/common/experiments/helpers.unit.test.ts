// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { anything, instance, mock, when } from 'ts-mockito';
import { DiscoveryVariants } from '../../../client/common/experiments/groups';
import { inDiscoveryExperiment } from '../../../client/common/experiments/helpers';
import { ExperimentService } from '../../../client/common/experiments/service';
import { IExperimentService } from '../../../client/common/types';

suite('Experiments - inDiscoveryExperiment()', () => {
    let experimentService: IExperimentService;
    setup(() => {
        experimentService = mock(ExperimentService);
    });

    test('Return true if in discoverWithFileWatching experiment', async () => {
        when(experimentService.inExperiment(DiscoveryVariants.discoverWithFileWatching)).thenResolve(true);
        const result = await inDiscoveryExperiment(instance(experimentService));
        expect(result).to.equal(true);
    });

    test('Return true if in discoveryWithoutFileWatching experiment', async () => {
        when(experimentService.inExperiment(DiscoveryVariants.discoveryWithoutFileWatching)).thenResolve(true);
        const result = await inDiscoveryExperiment(instance(experimentService));
        expect(result).to.equal(true);
    });

    test('Return false otherwise', async () => {
        when(experimentService.inExperiment(anything())).thenResolve(false);
        const result = await inDiscoveryExperiment(instance(experimentService));
        expect(result).to.equal(false);
    });
});
