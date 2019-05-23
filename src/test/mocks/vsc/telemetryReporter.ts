// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

"use strict";

// tslint:disable:all
import * as telemetry from "vscode-extension-telemetry";
export class vscMockTelemetryReporter implements telemetry.default {
    constructor() {
        //
    }

    public sendTelemetryEvent(): void {
        //
    }
}
