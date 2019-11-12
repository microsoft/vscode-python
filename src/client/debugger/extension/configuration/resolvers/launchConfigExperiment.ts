// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { DebugAdapterDescriptorFactory, DebugAdapterNewPtvsd, WebAppReload } from '../../../../common/experimentGroups';
import { traceInfo } from '../../../../common/logger';
import { IExperimentsManager } from '../../../../common/types';
import { sendTelemetryEvent } from '../../../../telemetry';
import { EventName } from '../../../../telemetry/constants';
import { LaunchRequestArguments } from '../../../types';
import { ILaunchDebugConfigurationResolverExperiment } from '../types';

@injectable()
export class LaunchDebugConfigurationExperiment implements ILaunchDebugConfigurationResolverExperiment {
    constructor(@inject(IExperimentsManager) private readonly experimentsManager: IExperimentsManager) {}

    public setExperimentConfiguration(debugConfiguration: LaunchRequestArguments): void {
        if (
            this.experimentsManager.inExperiment(DebugAdapterDescriptorFactory.experiment) &&
            this.experimentsManager.inExperiment(DebugAdapterNewPtvsd.experiment) &&
            this.experimentsManager.inExperiment(WebAppReload.experiment) &&
            this.isWebAppConfiguration(debugConfiguration)
        ) {
            traceInfo(`Configuration used for Web App Reload experiment (before):\n${JSON.stringify(debugConfiguration, undefined, 4)}`);

            let subProcessModified: boolean = false;
            if (!debugConfiguration.subProcess) {
                subProcessModified = true;
                debugConfiguration.subProcess = true;
            }

            let argsModified: boolean = false;
            const args = debugConfiguration.args.filter(arg => arg !== '--noreload' && arg !== '--no-reload');
            if (args.length !== debugConfiguration.args.length) {
                argsModified = true;
                debugConfiguration.args = args;
            }

            traceInfo(`Configuration used for Web App Reload experiment (after):\n${JSON.stringify(debugConfiguration, undefined, 4)}`);
            sendTelemetryEvent(EventName.PYTHON_WEB_APP_RELOAD, undefined, { subProcessModified, argsModified });
        }
    }

    private isWebAppConfiguration(debugConfiguration: LaunchRequestArguments): boolean {
        return debugConfiguration.django || debugConfiguration.flask || debugConfiguration.jinja || debugConfiguration.pyramid;
    }
}
