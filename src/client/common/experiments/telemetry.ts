// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IExperimentationTelemetry } from 'vscode-tas-client';
import { sendTelemetryEvent } from '../../telemetry';

export class ExperimentationTelemetry implements IExperimentationTelemetry {
    private readonly sharedProperties: { [key: string]: string } = {};

    public setSharedProperty(name: string, value: string): void {
        this.sharedProperties[name] = value;
    }

    public postEvent(eventName: string, props: Map<string, string>): void {
        // Add shared properties to telemetry props (we may overwrite existing ones).
        for (const [key, value] of Object.entries(this.sharedProperties)) {
            props.set(key, value);
        }

        // tslint:disable-next-line: no-any
        sendTelemetryEvent(eventName as any, undefined, props);
    }
}
