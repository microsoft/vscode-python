// tslint:disable:no-any no-require-imports no-function-expression no-invalid-this

import { ProgressLocation, ProgressOptions, Uri, window } from 'vscode';
import '../../common/extensions';
import { isTestExecution } from '../constants';
import { traceError, traceVerbose } from '../logger';
import { Resource } from '../types';
import { InMemoryInterpreterSpecificCache } from './cacheUtils';

// tslint:disable-next-line:no-require-imports no-var-requires
const _debounce = require('lodash/debounce') as typeof import('lodash/debounce');

type VoidFunction = (...any: any[]) => void;
type AsyncVoidFunction = (...any: any[]) => Promise<void>;

/**
 * Combine multiple sequential calls to the decorated function into one.
 * @export
 * @param {number} [wait] Wait time (milliseconds).
 * @returns void
 *
 * The point is to ensure that successive calls to the function result
 * only in a single actual call.  Following the most recent call to
 * the debounced function, debouncing resets after the "wait" interval
 * has elapsed.
 *
 * The decorated function must return either a void or a promise that
 * resolves to a void.
 */
export function debounce(wait?: number) {
    if (isTestExecution()) {
        // If running tests, lets not debounce (so tests run fast).
        wait = undefined;
        // tslint:disable-next-line:no-suspicious-comment
        // TODO: We should be able to return a noop decorator instead...
    }
    return makeDebounceDecorator(wait);
}

export function makeDebounceDecorator(wait?: number) {
    // tslint:disable-next-line:no-any no-function-expression
    return function (_target: any, _propertyName: string, descriptor: TypedPropertyDescriptor<VoidFunction> | TypedPropertyDescriptor<AsyncVoidFunction>) {
        // We could also make use of _debounce() options.  For instance,
        // the following causes the original method to be called
        // immediately:
        //
        //   {leading: true, trailing: false}
        //
        // The default is:
        //
        //   {leading: false, trailing: true}
        //
        // See https://lodash.com/docs/#debounce.
        const options = {};
        const originalMethod = descriptor.value!;
        const debounced = _debounce(
            function (this: any) {
                return originalMethod.apply(this, arguments as any);
            },
            wait,
            options
        );
        (descriptor as any).value = debounced;
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
