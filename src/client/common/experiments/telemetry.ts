// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IExperimentationTelemetry } from 'vscode-tas-client';
import { sendTelemetryEvent } from '../../telemetry';

export class ExperimentationTelemetry implements IExperimentationTelemetry {
    private readonly sharedProperties: Record<string, string> = {};

    public setSharedProperty(name: string, value: string): void {
        this.sharedProperties[name] = value;
    }

    public postEvent(eventName: string, properties: Map<string, string>): void {
        // Add shared properties to telemetry props (we may overwrite existing ones).
        Object.assign(properties, this.sharedProperties);

        const formattedProperties: { [key: string]: string } = {};
        properties.forEach((value, key) => {
            formattedProperties[key] = value;
        });

        // tslint:disable-next-line: no-any
        sendTelemetryEvent(eventName as any, undefined, formattedProperties);
    }
}
