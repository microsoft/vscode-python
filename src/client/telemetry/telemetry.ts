// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable-next-line:no-reference
/// <reference path="./vscode-extension-telemetry.d.ts" />
import { extensions } from 'vscode';
// tslint:disable-next-line:import-name
import TelemetryReporter from 'vscode-extension-telemetry';
import { PVSC_EXTENSION_ID } from '../common/constants';

// tslint:disable-next-line:no-any
let telemetryReporter: TelemetryReporter;
export function getTelemetryReporter() {
    if (telemetryReporter) {
        return telemetryReporter;
    }
    const extensionId = PVSC_EXTENSION_ID;
    // tslint:disable-next-line:no-non-null-assertion
    const extension = extensions.getExtension(extensionId)!;
    // tslint:disable-next-line:no-unsafe-any
    const extensionVersion = extension.packageJSON.version;
    // tslint:disable-next-line:no-unsafe-any
    const aiKey = extension.packageJSON.contributes.debuggers[0].aiKey;

    // tslint:disable-next-line:no-unsafe-any
    return telemetryReporter = new TelemetryReporter(extensionId, extensionVersion, aiKey);
}
