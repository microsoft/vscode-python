// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, named } from 'inversify';
import { Memento } from 'vscode';
import { getExperimentationService, IExperimentationService, TargetPopulation } from 'vscode-tas-client';
import { PVSC_EXTENSION_ID } from '../constants';
import { GLOBAL_MEMENTO, IConfigurationService, IExperimentService, IExtensions, IMemento } from '../types';
import { ExperimentationTelemetry } from './telemetry';

export class ExperimentService implements IExperimentService {
    private readonly experimentationService?: IExperimentationService;

    constructor(
        @inject(IConfigurationService) readonly configurationService: IConfigurationService,
        @inject(IExtensions) readonly extensions: IExtensions,
        @inject(IMemento) @named(GLOBAL_MEMENTO) readonly globalState: Memento
    ) {
        const settings = configurationService.getSettings(undefined);
        const enabled = settings.experiments.enabled;

        // Don't initialize experiment service if the extension's experiments setting is disabled.
        if (!enabled) {
            return;
        }

        const extension = extensions.getExtension(PVSC_EXTENSION_ID)!;
        const version = extension.packageJSON.version!;

        let targetPopulation: TargetPopulation;

        if (/dev/gi.test(version)) {
            targetPopulation = TargetPopulation.Insiders;
        } else {
            targetPopulation = TargetPopulation.Public;
        }

        const telemetryReporter = new ExperimentationTelemetry();

        this.experimentationService = getExperimentationService(
            PVSC_EXTENSION_ID,
            version,
            targetPopulation,
            telemetryReporter,
            globalState
        );
    }

    public async inExperiment(flight: string): Promise<boolean> {
        if (!this.experimentationService) {
            return false;
        }

        return this.experimentationService.isCachedFlightEnabled(flight);
    }
}
