// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:interface-name member-access no-single-line-block-comment no-any no-stateless-class member-ordering prefer-method-signature no-unnecessary-class

import { OutputEvent } from 'vscode-debugadapter';
import { DebuggerPerformanceTelemetry, DebuggerTelemetry } from '../../../telemetry/types';

export class TelemetryEvent extends OutputEvent {
    body!: {
        /** The category of output (such as: 'console', 'stdout', 'stderr', 'telemetry'). If not specified, 'console' is assumed. */
        category: string;
        /** The output to report. */
        output: string;
        /** Optional data to report. For the 'telemetry' category the data will be sent to telemetry, for the other categories the data is shown in JSON format. */
        data?: any;
    };
    constructor(output: string, data?: DebuggerTelemetry | DebuggerPerformanceTelemetry) {
        super(output, 'telemetry');
        if (data) {
            this.body.data = data;
        }
    }
}
export interface IDebugServer {
    port: number;
    host?: string;
}
