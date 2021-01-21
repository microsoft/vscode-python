// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IExperimentService } from '../types';
import { DiscoveryVariants } from './groups';

export async function inDiscoveryExperiment(experimentService: IExperimentService): Promise<boolean> {
    const results = await Promise.all([
        experimentService.inExperiment(DiscoveryVariants.discoverWithFileWatching),
        experimentService.inExperiment(DiscoveryVariants.discoveryWithoutFileWatching),
    ]);
    return results.includes(true);
}
