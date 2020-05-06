// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

declare module 'vscode-extension-telemetry' {
    export default class TelemetryReporter {
        /**
         * Constructs a new telemetry reporter
         * @param {string} extensionId All events will be prefixed with this event name
         * @param {string} extensionVersion Extension version to be reported with each event
         * @param {string} key The application insights key
         */
        // tslint:disable-next-line:no-empty
        constructor(extensionId: string, extensionVersion: string, key: string);

        /**
         * Sends a telemetry event
         * @param {string} eventName The event name
         * @param {object} properties An associative array of strings
         * @param {object} measures An associative array of numbers
         */
        // tslint:disable-next-line:member-access
        public sendTelemetryEvent(
            eventName: string,
            properties?: {
                [key: string]: string;
            },
            measures?: {
                [key: string]: number;
                // tslint:disable-next-line:no-empty
            }
        ): void;
    }
}
