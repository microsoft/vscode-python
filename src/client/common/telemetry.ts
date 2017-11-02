import { extensions } from 'vscode';
// tslint:disable-next-line:variable-name no-require-imports no-var-requires no-use-before-declare  no-unsafe-any
const TelemetryReporter: typeof TelemetryReporterType = require('vscode-extension-telemetry');

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
export const PYTHON_INTERPRETER = 'PYTHON_INTERPRETER';

type EditorLoadTelemetry = {
    condaVersion: string;
};
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
type PythonInterpreterTelemetry = {
    trigger: 'ui' | 'shebang' | 'load';
    failed: boolean;
    version: string;
    pipVersion: string;
};
type Terlemetries = FormatTelemetry | LintingTelemetry | EditorLoadTelemetry | PythonInterpreterTelemetry;
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

let telemetryReporter: TelemetryReporterType;
function getTelemetryReporter() {
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
export function sendTelemetryEvent(eventName: string, durationMs?: number, properties?: Terlemetries) {
    const reporter = getTelemetryReporter();
    const measures = typeof durationMs === 'number' ? { duration: durationMs } : undefined;

    // tslint:disable-next-line:no-any
    const customProperties: { [key: string]: string } = {};
    if (properties) {
        // tslint:disable-next-line:prefer-type-cast no-any
        const data = properties as any;
        Object.getOwnPropertyNames(data).forEach(prop => {
            // tslint:disable-next-line:prefer-type-cast no-any  no-unsafe-any
            (customProperties as any)[prop] = typeof data[prop] === 'string' ? data[prop] : data[prop].toString();
        });
    }
    //
    reporter.sendTelemetryEvent(eventName, properties ? customProperties : undefined, measures);
}

// tslint:disable-next-line:no-any function-name
export function captureTelemetry(eventName: string) {
    // tslint:disable-next-line:no-function-expression no-any
    return function (target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) {
        const originalMethod = descriptor.value;
        // tslint:disable-next-line:no-function-expression no-any
        descriptor.value = function (...args: any[]) {
            const stopWatch = new StopWatch();
            // tslint:disable-next-line:no-invalid-this no-use-before-declare no-unsafe-any
            const result = originalMethod.apply(this, args);

            // If method being wrapped returns a promise then wait for it.
            // tslint:disable-next-line:no-unsafe-any
            if (result && typeof result.then === 'function' && typeof result.catch === 'function') {
                // tslint:disable-next-line:prefer-type-cast
                (result as Promise<void>)
                    .then(data => {
                        sendTelemetryEvent(eventName, stopWatch.elpsedTime);
                        return data;
                    })
                    // tslint:disable-next-line:promise-function-async
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
    stopWatch?: StopWatch, properties?: Terlemetries) {
    stopWatch = stopWatch ? stopWatch : new StopWatch();
    if (typeof promise.then === 'function') {
        // tslint:disable-next-line:prefer-type-cast no-any
        (promise as Promise<any>)
            .then(data => {
                // tslint:disable-next-line:no-non-null-assertion
                sendTelemetryEvent(eventName, stopWatch!.elpsedTime, properties);
                return data;
                // tslint:disable-next-line:promise-function-async
            }, ex => {
                // tslint:disable-next-line:no-non-null-assertion
                sendTelemetryEvent(eventName, stopWatch!.elpsedTime, properties);
                return Promise.reject(ex);
            });
    } else {
        throw new Error('Method is neither a Promise nor a Theneable');
    }
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
