// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { StopWatch } from '../../utils/stopWatch';
import { getTelemetryReporter } from './telemetry';
import { TelemetryProperties } from './types';

export function sendTelemetryEvent(eventName: string, durationMs?: number, properties?: TelemetryProperties) {
    const reporter = getTelemetryReporter();
    const measures = typeof durationMs === 'number' ? { duration: durationMs } : undefined;

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
    reporter.sendTelemetryEvent(eventName, properties ? customProperties : undefined, measures);
}

// tslint:disable-next-line:no-any function-name
export function captureTelemetry(
    eventName: string,
    properties?: TelemetryProperties,
    captureDuration: boolean = true
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
                        sendTelemetryEvent(eventName, stopWatch.elapsedTime, properties);
                        return Promise.reject(ex);
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
                sendTelemetryEvent(eventName, stopWatch!.elapsedTime, properties);
                return Promise.reject(ex);
            });
    } else {
        throw new Error('Method is neither a Promise nor a Theneable');
    }
}
