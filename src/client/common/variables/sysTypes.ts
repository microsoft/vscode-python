/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { isFunction, isString } from '../utils/sysTypes';

type TypeConstraint = string | Function;

export function validateConstraints(args: any[], constraints: TypeConstraint[]): void {
    const len = Math.min(args.length, constraints.length);
    for (let i = 0; i < len; i++) {
        validateConstraint(args[i], constraints[i]);
    }
}

function validateConstraint(arg: any, constraint: TypeConstraint): void {
    if (isString(constraint)) {
        if (typeof arg !== constraint) {
            throw new Error(`argument does not match constraint: typeof ${constraint}`);
        }
    } else if (isFunction(constraint)) {
        if (arg instanceof constraint) {
            return;
        }
        if (arg && arg.constructor === constraint) {
            return;
        }
        if (constraint.length === 1 && constraint.call(undefined, arg) === true) {
            return;
        }
        throw new Error(
            'argument does not match one of these constraints: arg instanceof constraint, arg.constructor === constraint, nor constraint(arg) === true',
        );
    }
}
