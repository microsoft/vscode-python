import { extensions, workspace } from 'vscode';
// tslint:disable-next-line:import-name
import TelemetryReporter from 'vscode-extension-telemetry';

export const COMPLETION = 'COMPLETION';
export const DEFINITION = 'DEFINITION';
export const HOVER_DEFINITION = 'HOVER_DEFINITION';
export const REFERENCE = 'REFERENCE';
export const SIGNATURE = 'SIGNATURE';
export const SYMBOL = 'SYMBOL';
export const FORMAT_SORT_IMPORTS = 'FORMAT.SORT_IMPORTS';
export const FORMAT = 'FORMAT.FORMAT';
export const EDITOR_LOAD = 'EDITOR.LOAD';
export const LINTING = 'LINTING';
export const GO_TO_OBJECT_DEFINITION = 'GO_TO_OBJECT_DEFINITION';
export const UPDATE_PYSPARK_LIBRARY = 'UPDATE_PYSPARK_LIBRARY';
export const REFACTOR_RENAME = 'REFACTOR_RENAME';
export const REFACTOR_EXTRACT_VAR = 'REFACTOR_EXTRACT_VAR';
export const REFACTOR_EXTRACT_FUNCTION = 'REFACTOR_EXTRACT_FUNCTION';
export const REPL = 'REPL';

type TelemetryProperties = { [key: string]: string; };
type FormatTelemetry = {
    tool: 'autoppep8' | 'yapf';
    hasCustomArgs: boolean;
    formatSelection: boolean;
};
type LintingTelemetry = {
    tool: 'flake8' | 'mypy' | 'pep8' | 'prospector' | 'pydocstyle' | 'pylama' | 'pylint';
    hasCustomArgs: boolean;
    trigger: 'save' | 'auto';
    executableSpecified: boolean;
};
let s: FormatTelemetry;
s = { tool: 'yapf', hasCustomArgs: false, formatSelection: false };
export class StopWatch {
    private started: number = Date.now();
    private stopped?: number;
    public get elpsedTime() {
        return (this.stopped ? this.stopped : Date.now()) - this.started;
    }
    public stop() {
        this.stopped = Date.now();
    }
}

let telemetryReporter: TelemetryReporter;
function getTelemetryReporter() {
    if (telemetryReporter) {
        return telemetryReporter;
    }
    const extensionId = 'donjayamanne.python';
    const extension = extensions.getExtension(extensionId);
    const extensionVersion = extension.packageJSON.version;
    const aiKey = extension.packageJSON.contributes.debuggers[0].aiKey;
    return telemetryReporter = new TelemetryReporter(extensionId, extensionVersion, aiKey);
}
export function sendTelemetryEvent(eventName: string, durationMs?: number, properties?: FormatTelemetry | LintingTelemetry) {
    const reporter = getTelemetryReporter();
    const measures = typeof durationMs === 'number' ? { duration: durationMs } : undefined;

    const customProperties = {};
    if (properties) {
        Object.getOwnPropertyNames(properties).forEach(prop => {
            customProperties[prop] = typeof properties[prop] === 'string' ? properties[prop] : properties[prop].toString();
        });
    }
    reporter.sendTelemetryEvent(eventName, properties ? customProperties : undefined, measures);
}

// tslint:disable-next-line:no-any
type Handler = (...args: any[]) => any;

// tslint:disable-next-line:no-any function-name
export function captureTelemetry(eventName: string) {
    // tslint:disable-next-line:no-function-expression no-any
    return function (target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<Handler>) {
        const originalMethod = descriptor.value;
        // tslint:disable-next-line:no-function-expression no-any
        descriptor.value = function (...args: any[]) {
            const stopWatch = new StopWatch();
            // tslint:disable-next-line:no-invalid-this
            const result = originalMethod.apply(this, args);

            // If method being wrapped returns a promise then wait for it
            if (result && typeof result.then === 'function' && typeof result.catch === 'function') {
                // tslint:disable-next-line:prefer-type-cast
                (result as Promise<void>)
                    .then(data => {
                        sendTelemetryEvent(eventName, stopWatch.elpsedTime);
                        return data;
                    })
                    .catch(ex => {
                        sendTelemetryEvent(eventName, stopWatch.elpsedTime);
                        return Promise.reject(ex);
                    });
            } else {
                sendTelemetryEvent(eventName, stopWatch.elpsedTime);
            }

            return result;
        };

        return descriptor;
    };
}

// tslint:disable-next-line:no-any function-name
export function sendTelemetryWhenDone(eventName: string, promise: Promise<any> | Thenable<any>,
    stopWatch?: StopWatch, properties?: FormatTelemetry | LintingTelemetry) {
    stopWatch = stopWatch || new StopWatch();
    if (typeof promise.then === 'function') {
        // tslint:disable-next-line:prefer-type-cast no-any
        (promise as Promise<any>)
            .then(data => {
                sendTelemetryEvent(eventName, stopWatch.elpsedTime, properties);
                return data;
            }, ex => {
                sendTelemetryEvent(eventName, stopWatch.elpsedTime, properties);
                return Promise.reject(ex);
            });
    } else {
        throw new Error('Method is neither a Promise nor a Theneable');
    }
}
