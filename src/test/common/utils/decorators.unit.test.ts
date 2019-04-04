// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { Uri } from 'vscode';
import { Resource } from '../../../client/common/types';
import { clearCache } from '../../../client/common/utils/cacheUtils';
import {
    cacheResourceSpecificInterpreterData, makeDebounceAsyncDecorator, makeDebounceDecorator
} from '../../../client/common/utils/decorators';
import { sleep } from '../../core';

// tslint:disable:no-any max-func-body-length no-unnecessary-class
suite('Common Utils - Decorators', () => {
    teardown(() => {
        clearCache();
    });
    function createMockVSC(pythonPath: string): typeof import('vscode') {
        return {
            workspace: {
                getConfiguration: () => {
                    return {
                        get: () => {
                            return pythonPath;
                        },
                        inspect: () => {
                            return { globalValue: pythonPath };
                        }
                    };
                },
                getWorkspaceFolder: () => {
                    return;
                }
            },
            Uri: Uri
        } as any;
    }
    test('Result must be cached when using cache decorator', async () => {
        const vsc = createMockVSC('');
        class TestClass {
            public invoked = false;
            @cacheResourceSpecificInterpreterData('Something', 100000, vsc)
            public async doSomething(_resource: Resource, a: number, b: number): Promise<number> {
                this.invoked = true;
                return a + b;
            }
        }

        const cls = new TestClass();
        const uri = Uri.parse('a');
        const uri2 = Uri.parse('b');

        let result = await cls.doSomething(uri, 1, 2);
        expect(result).to.equal(3);
        expect(cls.invoked).to.equal(true, 'Must be invoked');

        cls.invoked = false;
        let result2 = await cls.doSomething(uri2, 2, 3);
        expect(result2).to.equal(5);
        expect(cls.invoked).to.equal(true, 'Must be invoked');

        cls.invoked = false;
        result = await cls.doSomething(uri, 1, 2);
        result2 = await cls.doSomething(uri2, 2, 3);
        expect(result).to.equal(3);
        expect(result2).to.equal(5);
        expect(cls.invoked).to.equal(false, 'Must not be invoked');
    });
    test('Cache result must be cleared when cache expires', async () => {
        const vsc = createMockVSC('');
        class TestClass {
            public invoked = false;
            @cacheResourceSpecificInterpreterData('Something', 100, vsc)
            public async doSomething(_resource: Resource, a: number, b: number): Promise<number> {
                this.invoked = true;
                return a + b;
            }
        }

        const cls = new TestClass();
        const uri = Uri.parse('a');
        let result = await cls.doSomething(uri, 1, 2);

        expect(result).to.equal(3);
        expect(cls.invoked).to.equal(true, 'Must be invoked');

        cls.invoked = false;
        result = await cls.doSomething(uri, 1, 2);

        expect(result).to.equal(3);
        expect(cls.invoked).to.equal(false, 'Must not be invoked');

        await sleep(110);

        cls.invoked = false;
        result = await cls.doSomething(uri, 1, 2);

        expect(result).to.equal(3);
        expect(cls.invoked).to.equal(true, 'Must be invoked');
    });

    // debounce()
    class Base {
        public created: number;
        public calls: string[];
        public timestamps: number[];
        constructor() {
            this.created = Date.now();
            this.calls = [];
            this.timestamps = [];
        }
        protected _addCall(funcname: string, timestamp?: number): void {
            if (!timestamp) {
                timestamp = Date.now();
            }
            this.calls.push(funcname);
            this.timestamps.push(timestamp);
        }
    }
    async function waitForCalls(timestamps: number[], count: number, delay = 10, timeout = 1000) {
        const steps = timeout / delay;
        for (let i = 0; i < steps; i += 1) {
            if (timestamps.length >= count) {
                return;
            }
            await sleep(delay);
        }
        if (timestamps.length < count) {
            throw Error(`timed out after ${timeout}ms`);
        }
    }
    test('Debounce: one sync call', async () => {
        const wait = 100;
        // tslint:disable-next-line:max-classes-per-file
        class One extends Base {
            @makeDebounceDecorator(wait)
            public run(): void {
                this._addCall('run');
            }
        }
        const one = new One();

        const start = Date.now();
        one.run();
        await waitForCalls(one.timestamps, 1);
        const delay = one.timestamps[0] - start;

        expect(delay).to.be.at.least(wait);
        expect(one.calls).to.deep.equal(['run']);
        expect(one.timestamps).to.have.lengthOf(one.calls.length);
    });
    test('Debounce: one async call & no wait', async () => {
        const wait = 100;
        // tslint:disable-next-line:max-classes-per-file
        class One extends Base {
            @makeDebounceAsyncDecorator(wait)
            public async run(): Promise<void> {
                this._addCall('run');
            }
        }
        const one = new One();

        const start = Date.now();
        let errored = false;
        one.run().catch(() => errored = true);
        await waitForCalls(one.timestamps, 1);
        const delay = one.timestamps[0] - start;

        expect(delay).to.be.at.least(wait);
        expect(one.calls).to.deep.equal(['run']);
        expect(one.timestamps).to.have.lengthOf(one.calls.length);
        expect(errored).to.be.equal(false, 'Exception raised when there shouldn\'t have been any');
    });
    test('Debounce: one async call', async () => {
        const wait = 100;
        // tslint:disable-next-line:max-classes-per-file
        class One extends Base {
            @makeDebounceAsyncDecorator(wait)
            public async run(): Promise<void> {
                this._addCall('run');
            }
        }
        const one = new One();

        const start = Date.now();
        await one.run();
        await waitForCalls(one.timestamps, 1);
        const delay = one.timestamps[0] - start;

        expect(delay).to.be.at.least(wait);
        expect(one.calls).to.deep.equal(['run']);
        expect(one.timestamps).to.have.lengthOf(one.calls.length);
    });
    test('Debounce: one async call and ensure exceptions are re-thrown', async () => {
        const wait = 100;
        // tslint:disable-next-line:max-classes-per-file
        class One extends Base {
            @makeDebounceAsyncDecorator(wait)
            public async run(): Promise<void> {
                this._addCall('run');
                throw new Error('Kaboom');
            }
        }
        const one = new One();

        const start = Date.now();
        let capturedEx: Error | undefined;
        await one.run().catch(ex => capturedEx = ex);
        await waitForCalls(one.timestamps, 1);
        const delay = one.timestamps[0] - start;

        expect(delay).to.be.at.least(wait);
        expect(one.calls).to.deep.equal(['run']);
        expect(one.timestamps).to.have.lengthOf(one.calls.length);
        expect(capturedEx).to.not.be.equal(undefined, 'Exception not re-thrown');
    });
    test('Debounce: multiple async calls', async () => {
        const wait = 100;
        // tslint:disable-next-line:max-classes-per-file
        class One extends Base {
            @makeDebounceAsyncDecorator(wait)
            public async run(): Promise<void> {
                this._addCall('run');
            }
        }
        const one = new One();

        const start = Date.now();
        let errored = false;
        one.run().catch(() => errored = true);
        one.run().catch(() => errored = true);
        one.run().catch(() => errored = true);
        one.run().catch(() => errored = true);
        await waitForCalls(one.timestamps, 1);
        const delay = one.timestamps[0] - start;

        expect(delay).to.be.at.least(wait);
        expect(one.calls).to.deep.equal(['run']);
        expect(one.timestamps).to.have.lengthOf(one.calls.length);
        expect(errored).to.be.equal(false, 'Exception raised when there shouldn\'t have been any');
    });
    test('Debounce: multiple async calls when awaiting on all', async function () {

        // This test is flakey.
        // tslint:disable-next-line:no-invalid-this
        this.skip();
        const wait = 100;
        // tslint:disable-next-line:max-classes-per-file
        class One extends Base {
            @makeDebounceAsyncDecorator(wait)
            public async run(): Promise<void> {
                this._addCall('run');
            }
        }
        const one = new One();

        const start = Date.now();
        await Promise.all([one.run(), one.run(), one.run(), one.run()]);
        await waitForCalls(one.timestamps, 1);
        const delay = one.timestamps[0] - start;

        expect(delay).to.be.at.least(wait);
        expect(one.calls).to.deep.equal(['run']);
        expect(one.timestamps).to.have.lengthOf(one.calls.length);
    });
    test('Debounce: multiple async calls & wait on some', async () => {
        const wait = 100;
        // tslint:disable-next-line:max-classes-per-file
        class One extends Base {
            @makeDebounceAsyncDecorator(wait)
            public async run(): Promise<void> {
                this._addCall('run');
            }
        }
        const one = new One();

        const start = Date.now();
        let errored = false;
        one.run().catch(() => errored = true);
        await one.run();
        one.run().catch(() => errored = true);
        one.run().catch(() => errored = true);
        await waitForCalls(one.timestamps, 2);
        const delay = one.timestamps[1] - start;

        expect(delay).to.be.at.least(wait);
        expect(one.calls).to.deep.equal(['run', 'run']);
        expect(one.timestamps).to.have.lengthOf(one.calls.length);
        expect(errored).to.be.equal(false, 'Exception raised when there shouldn\'t have been any');
    });
    test('Debounce: multiple calls grouped', async () => {
        const wait = 100;
        // tslint:disable-next-line:max-classes-per-file
        class One extends Base {
            @makeDebounceDecorator(wait)
            public run(): void {
                this._addCall('run');
            }
        }
        const one = new One();

        const start = Date.now();
        one.run();
        one.run();
        one.run();
        await waitForCalls(one.timestamps, 1);
        const delay = one.timestamps[0] - start;

        expect(delay).to.be.at.least(wait);
        expect(one.calls).to.deep.equal(['run']);
        expect(one.timestamps).to.have.lengthOf(one.calls.length);
    });
    test('Debounce: multiple calls spread', async function () {

        // This test is flakey.
        // tslint:disable-next-line:no-invalid-this
        this.skip();

        const wait = 100;
        // tslint:disable-next-line:max-classes-per-file
        class One extends Base {
            @makeDebounceDecorator(wait)
            public run(): void {
                this._addCall('run');
            }
        }
        const one = new One();

        one.run();
        await sleep(wait);
        one.run();
        await waitForCalls(one.timestamps, 2);

        expect(one.calls).to.deep.equal(['run', 'run']);
        expect(one.timestamps).to.have.lengthOf(one.calls.length);
    });
});
