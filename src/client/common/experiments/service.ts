// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, named } from 'inversify';
import { Memento } from 'vscode';
import { getExperimentationService, IExperimentationService, TargetPopulation } from 'vscode-tas-client';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { IApplicationEnvironment } from '../application/types';
import { GLOBAL_MEMENTO, IConfigurationService, IExperimentService, IMemento, IPythonSettings } from '../types';
import { ExperimentationTelemetry } from './telemetry';

export class ExperimentService implements IExperimentService {
    /**
     * Experiments the user requested to opt into manually.
     */
    public _optInto: string[] = [];
    /**
     * Experiments the user requested to opt out from manually.
     */
    public _optOutFrom: string[] = [];

    private readonly experimentationService?: IExperimentationService;
    private readonly settings: IPythonSettings;

    constructor(
        @inject(IConfigurationService) readonly configurationService: IConfigurationService,
        @inject(IApplicationEnvironment) private readonly appEnvironment: IApplicationEnvironment,
        @inject(IMemento) @named(GLOBAL_MEMENTO) readonly globalState: Memento
    ) {
        this.settings = configurationService.getSettings(undefined);

        // Users can only opt in or out of experiment groups, not control groups.
        const optInto = this.settings.experiments.optInto;
        const optOutFrom = this.settings.experiments.optOutFrom;
        this._optInto = optInto.filter((exp) => !exp.endsWith('control'));
        this._optOutFrom = optOutFrom.filter((exp) => !exp.endsWith('control'));

        // Don't initialize the experiment service if the extension's experiments setting is disabled.
        const enabled = this.settings.experiments.enabled;
        if (!enabled) {
            return;
        }

        let targetPopulation: TargetPopulation;

        if (this.appEnvironment.channel === 'insiders') {
            targetPopulation = TargetPopulation.Insiders;
        } else {
            targetPopulation = TargetPopulation.Public;
        }

        const telemetryReporter = new ExperimentationTelemetry();

        this.experimentationService = getExperimentationService(
            this.appEnvironment.extensionName,
            this.appEnvironment.packageJson.version!,
            targetPopulation,
            telemetryReporter,
            globalState
        );
    }

    public async inExperiment(experiment: string): Promise<boolean> {
        if (!this.experimentationService) {
            return false;
        }

        // Currently the service doesn't support opting in and out of experiments,
        // so we need to perform these checks and send the corresponding telemetry manually.
        if (this._optOutFrom.includes('All') || this._optOutFrom.includes(experiment)) {
            sendTelemetryEvent(EventName.PYTHON_EXPERIMENTS_OPT_IN_OUT, undefined, {
                expNameOptedOutOf: experiment
            });

            return false;
        }

        if (this._optInto.includes('All') || this._optInto.includes(experiment)) {
            sendTelemetryEvent(EventName.PYTHON_EXPERIMENTS_OPT_IN_OUT, undefined, {
                expNameOptedInto: experiment
            });

            return true;
        }

        return this.experimentationService.isCachedFlightEnabled(experiment);
    }
}
