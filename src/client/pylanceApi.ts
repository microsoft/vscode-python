// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { TelemetryEventMeasurements, TelemetryEventProperties } from '@vscode/extension-telemetry';

export interface TelemetryReporter {
    sendTelemetryEvent(
        eventName: string,
        properties?: TelemetryEventProperties,
        measurements?: TelemetryEventMeasurements,
    ): void;
    sendTelemetryErrorEvent(
        eventName: string,
        properties?: TelemetryEventProperties,
        measurements?: TelemetryEventMeasurements,
    ): void;
}

export interface ApiForPylance {
    getTelemetryReporter(): TelemetryReporter;
}
