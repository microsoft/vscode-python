// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

/*
There is a variety of testing doubles that may be used in place of
full-featured objects during tests, with the objective of isolating
the code under test.  Here are the most common ones:

 * dummy - a non-functional placeholder
 * stub  - has hard-coded return values
 * spy   - tracks calls
 * mock  - has expectations about calls and verifies them
 * fake  - mimics behavior (useful in functional/integration tests)

(See https://www.martinfowler.com/bliki/TestDouble.html.)

In this module you will find tools to facilitate some of those roles.
In particular, the "Stubbed" class is a mixture of stub and spy, with
just a hint of mock.  Notably, it:

 * stands in as for other values of a given type/interface
 * records all calls to stubbed methods
 * allows raising a pre-defined exception from a method
 * returns a pre-defined static value (for methods that return a value)

The goal here is the following properties:

 * easy to use
 * easy to read and understand what's happening
 * explicit about what is implemented

The "stubs" here achieve that because they look like simple, regular
interface implementations.

Here are some of the benefits of using them:

 * behavior is obvious
 * encourages keeping interfaces tight to needs
 * stubs will nearly always be defined in the same file as the tests

Here's an example of use:

    import { Stubbed, TestTracking } from '../doubles';

    interface Conn {
        send(request: string): Promise<number>;
        recv(): Promise<string>;
        count(): number;
        close(): void;
    }
    type RunFunc = (conn: Conn) => Promise<void>;

    suite('...', () => {
        let tracking : TestTracking;
        setup(() => {
            tracking = new TestTracking();
        });

        test('...', async () => {
            tracking.errors.setAll(
                null,
                null,
                null,
                null,
                Error('oops'),
                null,
                Error('already closed!')
            );
            const conn = new StubConn(tracking);

            await run(conn);

            tracking.verifyAll([
                ['count', []],
                ['send', ['<request>']],
                ['recv', []],
                ['send', ['<request>']],
                ['recv', []],
                ['close', []],
                ['count', []]
            ]);
        });
    });

    class StubConn {
        public returnSend?: number;
        public returnRecv?: string[];  // One for each call.
        public returnCount?: number;

        public async send(request: string): Promise<number> {
            this._calls.add('send', request);
            this._errors.tryNext();
            return Promise.resolve(this.returnSend);
        }

        public async recv(): Promise<string> {
            return Promise.resolve(
                this._handleMethod('recv') as string);
        }

        public count(): number {
            return this._handleMethod('count') as number;
        }

        public close() {
            //this._handleMethod('close');
            this._calls.add('close');
            this._errors.tryNext();
        }
    }

This module is available as an alternative to "mocks" for cases where
the tests do not need the extra complexity that comes with "mocks".
*/

'use strict';

// tslint:disable:max-classes-per-file

import { assert, expect } from 'chai';

/**
 * Call records the name of a called function and the passed args.
 */
export type Call = [
    /**
     * This is the name of the function that was called.
     */
    string,
    /**
     * This is the list of arguments passed to the function. They are
     * in the same order as the function's parameters.
     */
    // tslint:disable-next-line:no-any
    any[]  // args
];

/**
 * The list of calls made during a test.
 */
export class Calls {
    // The list of calls in the order in which they were made.
    private calls: Call[];

    constructor() {
        this.calls = [];
    }

    /**
     * Return a copy of the raw calls, in the original order.
     */
    public snapshot(): Call[] {
        return this.calls.slice(0);  // a copy
    }

    /**
     * Clear the recorded calls.
     */
    public reset() {
        this.calls = [];
    }

    //=======================
    // during execution:

    /**
     * Record a call for later inspection (e.g. via checkCalls()).
     *
     * This will be called at the beginning of each stubbed-out method.
     */
    // tslint:disable-next-line:no-any
    public add(name: string, ...args: any[]) {
        this.calls.push([name, args]);
    }

    //=======================
    // after execution:

    /**
     * Verify that the history of calls matches expectations.
     */
    public check(expected: Call[]) {
        assert.deepEqual(this.calls, expected);
    }

    /*
     Posible other methods:
     * checkCallsUnordered
     * checkCallsSubset
     * checkCall (by index)
     * checkCallNames
     * checkNoCalls
     */
}

/**
 * The errors to throw accross all tracked calls.
 */
export class Errors {
    private errors: (Error | null)[];

    constructor() {
        this.errors = [];
    }

    /**
     * Return a copy of the remaining errors.
     */
    public snapshot(): (Error | null)[] {
        return this.errors.slice(0);  // a copy
    }

    //=======================
    // before execution:

    /*
     * Set the sequence of "errors" to match to calls.
     *
     * Each item is either an error or null corresponding to an
     * expected call, where null represents that there is no error for
     * that call.  An empty list (the default) indicates that no further
     * calls will fail.
     *
     * Each call to tryNext() popa off the next "error" from the front.
     * So the following:
     *
     *   errors.setAll(
     *       null,
     *       null,
     *       null,
     *       new Error('oops')
     *   );
     *
     * Means that no error will be thrown for the first 3 calls, the
     * fourth call will throw, and then any further calls will not throw
     * an error.
     */
    public setAll(...errors: (Error | null)[]) {
        this.errors = errors;
    }

    //=======================
    // during execution:

    /*
     * Throw the next error, if there is one.
     *
     * The error corresponds to the nth call (across all tracked calls).
     * So all stubbed-out methods must call this method.
     */
    public tryNext() {
        const err = this.errors.shift();
        if (err !== null && err !== undefined) {
            throw err;
        }
    }

    //=======================
    // after execution:

    /**
     * Verify that the list of unused errors is empty.
     */
    public check() {
        assert.equal(this.errors.length, 0);
    }
}

/**
 * The testing state that can be shared by multiple Stubbed.
 */
export class TestTracking {
    constructor(
        public readonly calls: Calls = new Calls(),
        public readonly errors: Errors = new Errors()
    ) { }

    /**
     * Check the calls and the errors.
     */
    public verifyAll(expected: Call[]) {
        this.calls.check(expected);
        this.errors.check();
    }
}

/**
 * The base class for stubbed-out classes that implement an API.
 *
 * Subclasses must add an optional public "return*" property
 * corresponding to each method that returns a value.  For example,
 * a subclass with a "runAll" method that returns a string would define
 * the following property:
 *
 *   public returnRunAll?: string;
 *
 * All implemented API methods (including getters, etc.) should trigger
 * tracking for every call.  Example:
 *
 *       this._calls.add('methodName', arg1, arg2);
 *       this._errors.tryNext();
 *
 * This can also be achieved by calling "this._handleMethod()", which
 * also looks up the appropriate return value.
 *
 * All properties of this base class have "underscore" names to avoid
 * possible conflicts with the API a subclass is implementing.
 */
export class Stubbed {
    protected readonly _calls: Calls;
    protected readonly _errors: Errors;
    constructor(tracking: TestTracking) {
        this._calls = tracking.calls;
        this._errors = tracking.errors;
    }

    /**
     * Subclasses use this method to do the typical stub method
     * operations.  If there is a corresponding "return*" property for
     * the method then that value gets checked and returned.  The caller
     * is responsible for casting the result to the appropriate type
     * (and calling Promise.resolve() if async).
     */
    // tslint:disable-next-line:no-any
    protected _handleMethod(method: string, ...args: any[]): any {
        this._calls.add(method, ...args);
        this._errors.tryNext();

        // Deal with the return value.
        const prop = `return${method[0].toUpperCase()}${method.slice(1)}`;
        if (!this.hasOwnProperty(prop)) {
            return;
        }

        const notSet = undefined;
        // tslint:disable-next-line:no-any
        const val = (this as any)[prop];
        expect(val).to.not.equal(notSet, `return var ${prop} not set`);
        return val;
    }
}
