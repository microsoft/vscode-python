import '../../common/extensions';
import { isTestExecution } from '../constants';
import { traceError, traceVerbose } from '../logger';
import { createDeferred, Deferred } from './async';
import { getCacheKeyFromFunctionArgs, getGlobalCacheStore } from './cacheUtils';
import { TraceInfo, tracing } from './misc';

const _debounce = require('lodash/debounce') as typeof import('lodash/debounce');

type VoidFunction = () => any;
type AsyncVoidFunction = () => Promise<any>;

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
 */
export function debounceSync(wait?: number) {
    if (isTestExecution()) {
        // If running tests, lets debounce until the next cycle in the event loop.
        // Same as `setTimeout(()=> {}, 0);` with a value of `0`.
        wait = undefined;
    }
    return makeDebounceDecorator(wait);
}

/**
 * Combine multiple sequential calls to the decorated async function into one.
 * @export
 * @param {number} [wait] Wait time (milliseconds).
 * @returns void
 *
 * The point is to ensure that successive calls to the function result
 * only in a single actual call.  Following the most recent call to
 * the debounced function, debouncing resets after the "wait" interval
 * has elapsed.
 */
export function debounceAsync(wait?: number) {
    if (isTestExecution()) {
        // If running tests, lets debounce until the next cycle in the event loop.
        // Same as `setTimeout(()=> {}, 0);` with a value of `0`.
        wait = undefined;
    }
    return makeDebounceAsyncDecorator(wait);
}

export function makeDebounceDecorator(wait?: number) {
    return function (_target: any, _propertyName: string, descriptor: TypedPropertyDescriptor<VoidFunction>) {
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
            options,
        );
        (descriptor as any).value = debounced;
    };
}

export function makeDebounceAsyncDecorator(wait?: number) {
    return function (_target: any, _propertyName: string, descriptor: TypedPropertyDescriptor<AsyncVoidFunction>) {
        type StateInformation = {
            started: boolean;
            deferred: Deferred<any> | undefined;
            timer: NodeJS.Timer | number | undefined;
        };
        const originalMethod = descriptor.value!;
        const state: StateInformation = { started: false, deferred: undefined, timer: undefined };

        // Lets defer execution using a setTimeout for the given time.
        (descriptor as any).value = function (this: any) {
            const existingDeferred: Deferred<any> | undefined = state.deferred;
            if (existingDeferred && state.started) {
                return existingDeferred.promise;
            }

            // Clear previous timer.
            const existingDeferredCompleted = existingDeferred && existingDeferred.completed;
            const deferred = (state.deferred =
                !existingDeferred || existingDeferredCompleted ? createDeferred<any>() : existingDeferred);
            if (state.timer) {
                clearTimeout(state.timer as any);
            }

            state.timer = setTimeout(async () => {
                state.started = true;
                originalMethod
                    .apply(this)
                    .then((r) => {
                        state.started = false;
                        deferred.resolve(r);
                    })
                    .catch((ex) => {
                        state.started = false;
                        deferred.reject(ex);
                    });
            }, wait || 0);
            return deferred.promise;
        };
    };
}

type PromiseFunctionWithAnyArgs = (...any: any) => Promise<any>;
const cacheStoreForMethods = getGlobalCacheStore();
export function cache(expiryDurationMs: number) {
    return function (
        target: Object,
        propertyName: string,
        descriptor: TypedPropertyDescriptor<PromiseFunctionWithAnyArgs>,
    ) {
        const originalMethod = descriptor.value!;
        const className = 'constructor' in target && target.constructor.name ? target.constructor.name : '';
        const keyPrefix = `Cache_Method_Output_${className}.${propertyName}`;
        descriptor.value = async function (...args: any) {
            if (isTestExecution()) {
                return originalMethod.apply(this, args) as Promise<any>;
            }
            const key = getCacheKeyFromFunctionArgs(keyPrefix, args);
            const cachedItem = cacheStoreForMethods.get(key);
            if (cachedItem && cachedItem.expiry > Date.now()) {
                traceVerbose(`Cached data exists ${key}`);
                return Promise.resolve(cachedItem.data);
            }
            const promise = originalMethod.apply(this, args) as Promise<any>;
            promise
                .then((result) =>
                    cacheStoreForMethods.set(key, { data: result, expiry: Date.now() + expiryDurationMs }),
                )
                .ignoreErrors();
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
export function swallowExceptions(scopeName?: string) {
    return function (_target: any, propertyName: string, descriptor: TypedPropertyDescriptor<any>) {
        const originalMethod = descriptor.value!;
        const errorMessage = `Python Extension (Error in ${scopeName || propertyName}, method:${propertyName}):`;

        descriptor.value = function (...args: any[]) {
            try {
                const result = originalMethod.apply(this, args);

                // If method being wrapped returns a promise then wait and swallow errors.
                if (result && typeof result.then === 'function' && typeof result.catch === 'function') {
                    return (result as Promise<void>).catch((error) => {
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

// Information about a function/method call.
export type CallInfo = {
    kind: string; // "Class", etc.
    name: string;

    args: any[];
};

// Return a decorator that traces the decorated function.
export function trace(log: (c: CallInfo, t: TraceInfo) => void) {
    return function (_: Object, __: string, descriptor: TypedPropertyDescriptor<any>) {
        const originalMethod = descriptor.value;

        descriptor.value = function (...args: any[]) {
            const call = {
                kind: 'Class',
                name: _ && _.constructor ? _.constructor.name : '',
                args,
            };

            const scope = this;
            return tracing(
                // "log()"
                (t) => log(call, t),
                // "run()"
                () => originalMethod.apply(scope, args),
            );
        };

        return descriptor;
    };
}
