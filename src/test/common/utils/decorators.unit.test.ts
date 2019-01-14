// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { Uri } from 'vscode';
import { Resource } from '../../../client/common/types';
import { clearCache } from '../../../client/common/utils/cacheUtils';
import { cacheResourceSpecificInterpreterData } from '../../../client/common/utils/decorators';
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
});
