// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import { LocalZMQKernel } from '../../common/experiments/groups';
import { traceError, traceInfo } from '../../common/logger';
import { IConfigurationService, IExperimentsManager } from '../../common/types';
import { sendTelemetryEvent } from '../../telemetry';
import { Settings, Telemetry } from '../constants';
import { IRawNotebookSupportedService } from '../types';

// This class check to see if we have everything in place to support a raw kernel launch on the machine
@injectable()
export class RawNotebookSupportedService implements IRawNotebookSupportedService {
    // Keep track of our ZMQ import check, this doesn't change with settings so we only want to do this once
    private _zmqSupportedPromise: Promise<boolean> | undefined;

    constructor(
        @inject(IConfigurationService) private readonly configuration: IConfigurationService,
        @inject(IExperimentsManager) private readonly experimentsManager: IExperimentsManager
    ) {}

    // Check to see if we have all that we need for supporting raw kernel launch
    public async supported(): Promise<boolean> {
        // Save the ZMQ support for last, since it's probably the slowest part
        return this.localLaunch() && this.experimentEnabled() && (await this.zmqSupported()) ? true : false;
    }

    private localLaunch(): boolean {
        const settings = this.configuration.getSettings(undefined);
        const serverURI: string | undefined = settings.datascience.jupyterServerURI;

        if (!serverURI || serverURI.toLowerCase() === Settings.JupyterServerLocalLaunch) {
            return true;
        }

        return false;
    }

    // Enable if we are in our experiment or in the insiders channel
    private experimentEnabled(): boolean {
        return (
            this.experimentsManager.inExperiment(LocalZMQKernel.experiment) ||
            (this.configuration.getSettings().insidersChannel &&
                this.configuration.getSettings().insidersChannel !== 'off')
        );
    }

    // Check to see if this machine supports our local ZMQ launching
    private async zmqSupported(): Promise<boolean> {
        if (!this._zmqSupportedPromise) {
            this._zmqSupportedPromise = this.zmqSupportedImpl();
        }

        return this._zmqSupportedPromise;
    }

    private async zmqSupportedImpl(): Promise<boolean> {
        try {
            await import('zeromq');
            traceInfo(`ZMQ install verified.`);
            sendTelemetryEvent(Telemetry.ZMQSupported);
        } catch (e) {
            traceError(`Exception while attempting zmq :`, e);
            sendTelemetryEvent(Telemetry.ZMQNotSupported);
            return false;
        }

        return true;
    }
}
