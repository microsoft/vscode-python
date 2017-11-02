import { extensions } from 'vscode';
// tslint:disable-next-line:variable-name no-require-imports no-var-requires no-use-before-declare  no-unsafe-any
const TelemetryReporter: typeof TelemetryReporterType = require('vscode-extension-telemetry');

let telemetryReporter: TelemetryReporterType;
export function getTelemetryReporter() {
    if (telemetryReporter) {
        return telemetryReporter;
    }
    const extensionId = 'donjayamanne.python';
    // tslint:disable-next-line:no-non-null-assertion
    const extension = extensions.getExtension(extensionId)!;
    // tslint:disable-next-line:no-unsafe-any
    const extensionVersion = extension.packageJSON.version;
    // tslint:disable-next-line:no-unsafe-any
    const aiKey = extension.packageJSON.contributes.debuggers[0].aiKey;
    // tslint:disable-next-line:no-unsafe-any
    return telemetryReporter = new TelemetryReporter(extensionId, extensionVersion, aiKey);
}

class TelemetryReporterType {
    /**
     * Constructs a new telemetry reporter
     * @param {string} extensionId All events will be prefixed with this event name
     * @param {string} extensionVersion Extension version to be reported with each event
     * @param {string} key The application insights key
     */
    // tslint:disable-next-line:no-empty
    constructor(extensionId: string, extensionVersion: string, key: string) { }

    /**
     * Sends a telemetry event
     * @param {string} eventName The event name
     * @param {object} properties An associative array of strings
     * @param {object} measures An associative array of numbers
     */
    // tslint:disable-next-line:member-access
    public sendTelemetryEvent(eventName: string, properties?: {
        [key: string]: string;
    }, measures?: {
        [key: string]: number;
        // tslint:disable-next-line:no-empty
    }): void { }
}
