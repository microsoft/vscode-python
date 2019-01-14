// tslint:disable:no-any no-require-imports no-function-expression no-invalid-this

import { ProgressLocation, ProgressOptions, Uri, window } from 'vscode';
import '../../common/extensions';
import { isTestExecution } from '../constants';
import { traceError, traceVerbose } from '../logger';
import { Resource } from '../types';
import { InMemoryInterpreterSpecificCache } from './cacheUtils';

// tslint:disable-next-line:no-require-imports no-var-requires
const _debounce = require('lodash/debounce') as typeof import('lodash/debounce');

/**
 * Debounces a function execution. Function must return either a void or a promise that resolves to a void.
 * @export
 * @param {number} [wait] Wait time.
 * @returns void
 */
export function debounce(wait?: number) {
    // tslint:disable-next-line:no-any no-function-expression
    return function (_target: any, _propertyName: string, descriptor: TypedPropertyDescriptor<any>) {
        const originalMethod = descriptor.value!;
        // If running tests, lets not debounce (so tests run fast).
        wait = wait && isTestExecution() ? undefined : wait;
        // tslint:disable-next-line:no-invalid-this no-any
        (descriptor as any).value = _debounce(function () { return originalMethod.apply(this, arguments); }, wait);
    };
}

type VSCodeType = typeof import('vscode');
type PromiseFunctionWithFirstArgOfResource = (...any: [Uri | undefined, ...any[]]) => Promise<any>;

export function clearCachedResourceSpecificIngterpreterData(key: string, resource: Resource, vscode: VSCodeType = require('vscode')) {
    const cache = new InMemoryInterpreterSpecificCache(key, 0, [resource], vscode);
    cache.clear();
}
export function cacheResourceSpecificInterpreterData(key: string, expiryDurationMs: number, vscode: VSCodeType = require('vscode')) {
    return function (_target: Object, _propertyName: string, descriptor: TypedPropertyDescriptor<PromiseFunctionWithFirstArgOfResource>) {
        const originalMethod = descriptor.value!;
        descriptor.value = async function (...args: [Uri | undefined, ...any[]]) {
            const cache = new InMemoryInterpreterSpecificCache(key, expiryDurationMs, args, vscode);
            if (cache.hasData) {
                traceVerbose(`Cached data exists ${key}, ${args[0] ? args[0].fsPath : '<No Resource>'}`);
                return Promise.resolve(cache.data);
            }
            const promise = originalMethod.apply(this, args) as Promise<any>;
            promise.then(result => cache.data = result).ignoreErrors();
            return promise;
        };
    };
}

/**
 * Swallows exceptions thrown by a function. Function must return either a void or a promise that resolves to a void.
 * When exceptions (including in promises) are caught, this will return `undefined` to calling code.
 * @export
 * @param {string} [scopeName] Scope for the error message to be logged along with the error.
 * @returns void
 */
export function swallowExceptions(scopeName: string) {
    // tslint:disable-next-line:no-any no-function-expression
    return function (_target: any, propertyName: string, descriptor: TypedPropertyDescriptor<any>) {
        const originalMethod = descriptor.value!;
        const errorMessage = `Python Extension (Error in ${scopeName}, method:${propertyName}):`;
        // tslint:disable-next-line:no-any no-function-expression
        descriptor.value = function (...args: any[]) {
            try {
                // tslint:disable-next-line:no-invalid-this no-use-before-declare no-unsafe-any
                const result = originalMethod.apply(this, args);

                // If method being wrapped returns a promise then wait and swallow errors.
                if (result && typeof result.then === 'function' && typeof result.catch === 'function') {
                    return (result as Promise<void>).catch(error => {
                        if (isTestExecution()) {
                            return;
                        }
                        traceError(errorMessage, error);
                    });
                }
            } catch (error) {
                if (isTestExecution()) {
                    return;
                }
                traceError(errorMessage, error);
            }
        };
    };
}

// tslint:disable-next-line:no-any
type PromiseFunction = (...any: any[]) => Promise<any>;

export function displayProgress(title: string, location = ProgressLocation.Window) {
    return function (_target: Object, _propertyName: string, descriptor: TypedPropertyDescriptor<PromiseFunction>) {
        const originalMethod = descriptor.value!;
        // tslint:disable-next-line:no-any no-function-expression
        descriptor.value = async function (...args: any[]) {
            const progressOptions: ProgressOptions = { location, title };
            // tslint:disable-next-line:no-invalid-this
            const promise = originalMethod.apply(this, args);
            if (!isTestExecution()) {
                window.withProgress(progressOptions, () => promise);
            }
            return promise;
        };
    };
}
