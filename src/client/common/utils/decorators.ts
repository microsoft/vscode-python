import * as _ from 'lodash';
import { isTestExecution } from '../constants';

type AsyncVoidAction = (...params: {}[]) => Promise<void>;
type VoidAction = (...params: {}[]) => void;

/**
 * Debounces a function execution. Function must return either a void or a promise that resolves to a void.
 * @export
 * @param {number} [wait] Wait time.
 * @returns void
 */
export function debounce(wait?: number) {
    // tslint:disable-next-line:no-any no-function-expression
    return function (_target: any, _propertyName: string, descriptor: TypedPropertyDescriptor<VoidAction> | TypedPropertyDescriptor<AsyncVoidAction>) {
        const originalMethod = descriptor.value!;
        // tslint:disable-next-line:no-invalid-this no-any
        (descriptor as any).value = _.debounce(function () { return originalMethod.apply(this, arguments); }, wait);
    };
}

/**
 * Swallows exceptions thrown by a function. Function must return either a void or a promise that resolves to a void.
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
                        console.error(errorMessage, error);
                    });
                }
            } catch (error) {
                if (isTestExecution()) {
                    return;
                }
                console.error(errorMessage, error);
            }
        };
    };
}
