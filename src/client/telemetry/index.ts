// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-reference no-any import-name
/// <reference path="./vscode-extension-telemetry.d.ts" />
import { basename as pathBasename, sep as pathSep } from 'path';
import * as stackTrace from 'stack-trace';
import TelemetryReporter from 'vscode-extension-telemetry';
import { EXTENSION_ROOT_DIR, isTestExecution, PVSC_EXTENSION_ID } from '../common/constants';
import { StopWatch } from '../common/utils/stopWatch';
import { TelemetryProperties } from './types';

/**
 * Checks whether telemetry is supported.
 * Its possible this function gets called within Debug Adapter, vscode isn't available in there.
 * Withiin DA, there's a completely different way to send telemetry.
 * @returns {boolean}
 */
function isTelemetrySupported(): boolean {
    try {
        // tslint:disable-next-line:no-require-imports
        const vsc = require('vscode');
        // tslint:disable-next-line:no-require-imports
        const reporter = require('vscode-extension-telemetry');
        return vsc !== undefined && reporter !== undefined;
    } catch {
        return false;
    }
}
let telemetryReporter: TelemetryReporter;
function getTelemetryReporter() {
    if (!isTestExecution() && telemetryReporter) {
        return telemetryReporter;
    }
    const extensionId = PVSC_EXTENSION_ID;
    // tslint:disable-next-line:no-require-imports
    const extensions = (require('vscode') as typeof import('vscode')).extensions;
    // tslint:disable-next-line:no-non-null-assertion
    const extension = extensions.getExtension(extensionId)!;
    // tslint:disable-next-line:no-unsafe-any
    const extensionVersion = extension.packageJSON.version;
    // tslint:disable-next-line:no-unsafe-any
    const aiKey = extension.packageJSON.contributes.debuggers[0].aiKey;

    // tslint:disable-next-line:no-require-imports
    const reporter = require('vscode-extension-telemetry').default as typeof TelemetryReporter;
    return telemetryReporter = new reporter(extensionId, extensionVersion, aiKey);
}

export function sendTelemetryEvent(eventName: string, durationMs?: { [key: string]: number } | number, properties?: TelemetryProperties, ex?: Error) {
    if (isTestExecution() || !isTelemetrySupported()) {
        return;
    }
    const reporter = getTelemetryReporter();
    const measures = typeof durationMs === 'number' ? { duration: durationMs } : (durationMs ? durationMs : undefined);

    // tslint:disable-next-line:no-any
    const customProperties: { [key: string]: string } = {};
    if (properties) {
        // tslint:disable-next-line:prefer-type-cast no-any
        const data = properties as any;
        Object.getOwnPropertyNames(data).forEach(prop => {
            if (data[prop] === undefined || data[prop] === null) {
                return;
            }
            // tslint:disable-next-line:prefer-type-cast no-any  no-unsafe-any
            (customProperties as any)[prop] = typeof data[prop] === 'string' ? data[prop] : data[prop].toString();
        });
    }
    if (ex) {
        customProperties.stackTrace = getStackTrace(ex);
    }
    if (ex && eventName !== 'ERROR') {
        reporter.sendTelemetryEvent('ERROR', customProperties, measures);
    }
    reporter.sendTelemetryEvent(eventName, customProperties, measures);
}

// tslint:disable-next-line:no-any function-name
export function captureTelemetry(
    eventName: string,
    properties?: TelemetryProperties,
    captureDuration: boolean = true,
    failureEventName?: string
) {
    // tslint:disable-next-line:no-function-expression no-any
    return function (target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) {
        const originalMethod = descriptor.value;
        // tslint:disable-next-line:no-function-expression no-any
        descriptor.value = function (...args: any[]) {
            if (!captureDuration) {
                sendTelemetryEvent(eventName, undefined, properties);
                // tslint:disable-next-line:no-invalid-this
                return originalMethod.apply(this, args);
            }

            const stopWatch = new StopWatch();
            // tslint:disable-next-line:no-invalid-this no-use-before-declare no-unsafe-any
            const result = originalMethod.apply(this, args);

            // If method being wrapped returns a promise then wait for it.
            // tslint:disable-next-line:no-unsafe-any
            if (result && typeof result.then === 'function' && typeof result.catch === 'function') {
                // tslint:disable-next-line:prefer-type-cast
                (result as Promise<void>)
                    .then(data => {
                        sendTelemetryEvent(eventName, stopWatch.elapsedTime, properties);
                        return data;
                    })
                    // tslint:disable-next-line:promise-function-async
                    .catch(ex => {
                        // tslint:disable-next-line:no-any
                        properties = properties || {};
                        (properties as any).failed = true;
                        sendTelemetryEvent(failureEventName ? failureEventName : eventName, stopWatch.elapsedTime, properties, ex);
                    });
            } else {
                sendTelemetryEvent(eventName, stopWatch.elapsedTime, properties);
            }

            return result;
        };

        return descriptor;
    };
}

// tslint:disable-next-line:no-any function-name
export function sendTelemetryWhenDone(eventName: string, promise: Promise<any> | Thenable<any>,
    stopWatch?: StopWatch, properties?: TelemetryProperties) {
    stopWatch = stopWatch ? stopWatch : new StopWatch();
    if (typeof promise.then === 'function') {
        // tslint:disable-next-line:prefer-type-cast no-any
        (promise as Promise<any>)
            .then(data => {
                // tslint:disable-next-line:no-non-null-assertion
                sendTelemetryEvent(eventName, stopWatch!.elapsedTime, properties);
                return data;
                // tslint:disable-next-line:promise-function-async
            }, ex => {
                // tslint:disable-next-line:no-non-null-assertion
                sendTelemetryEvent(eventName, stopWatch!.elapsedTime, properties, ex);
                return Promise.reject(ex);
            });
    } else {
        throw new Error('Method is neither a Promise nor a Theneable');
    }
}

function sanitizeFilename(filename: string): string {
    if (filename.startsWith(EXTENSION_ROOT_DIR)) {
        filename = `<pvsc>${filename.substring(EXTENSION_ROOT_DIR.length)}`;
    } else {
        // We don't really care about files outside our extension.
        filename = `<hidden>${pathSep}${pathBasename(filename)}`;
    }
    return filename;
}

function sanitizeName(name: string): string {
    if (name.indexOf('/') === -1 && name.indexOf('\\') === -1) {
        return name;
    } else {
        return '<hidden>';
    }
}

function getStackTrace(ex: Error): string {
    // We aren't showing the error message (ex.message) since it might
    // contain PII.
    let trace = '';
    for (const frame of stackTrace.parse(ex)) {
        let filename = frame.getFileName();
        if (filename) {
            filename = sanitizeFilename(filename);
            const lineno = frame.getLineNumber();
            const colno = frame.getColumnNumber();
            trace += `\n\tat ${getCallsite(frame)} ${filename}:${lineno}:${colno}`;
        } else {
            trace += '\n\tat <anonymous>';
        }
    }
    return trace.trim();
}

function getCallsite(frame: stackTrace.StackFrame) {
    const parts: string[] = [];
    if (typeof frame.getTypeName() === 'string' && frame.getTypeName().length > 0) {
        parts.push(frame.getTypeName());
    }
    if (typeof frame.getMethodName() === 'string' && frame.getMethodName().length > 0) {
        parts.push(frame.getMethodName());
    }
    if (typeof frame.getFunctionName() === 'string' && frame.getFunctionName().length > 0) {
        if (parts.length !== 2 || parts.join('.') !== frame.getFunctionName()) {
            parts.push(frame.getFunctionName());
        }
    }
    return parts.map(sanitizeName).join('.');
}
