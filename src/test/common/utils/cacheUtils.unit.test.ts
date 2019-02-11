// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { Uri } from 'vscode';
import { clearCache, InMemoryInterpreterSpecificCache } from '../../../client/common/utils/cacheUtils';
import { sleep } from '../../core';

// tslint:disable:no-any max-func-body-length
suite('Common Utils - CacheUtils', () => {
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
    ['hello', undefined, { date: new Date(), hello: 1234 }].forEach(dataToStore => {
        test('Data is stored in cache (without workspaces)', () => {
            const pythonPath = 'Some Python Path';
            const vsc = createMockVSC(pythonPath);
            const resource = Uri.parse('a');
            const cache = new InMemoryInterpreterSpecificCache('Something', 10000, [resource], vsc);

            expect(cache.hasData).to.be.equal(false, 'Must not have any data');

            cache.data = dataToStore;

            expect(cache.hasData).to.be.equal(true, 'Must have data');
            expect(cache.data).to.be.deep.equal(dataToStore);
        });
        test('Data is stored in cache must be cleared when clearing globally', () => {
            const pythonPath = 'Some Python Path';
            const vsc = createMockVSC(pythonPath);
            const resource = Uri.parse('a');
            const cache = new InMemoryInterpreterSpecificCache('Something', 10000, [resource], vsc);

            expect(cache.hasData).to.be.equal(false, 'Must not have any data');

            cache.data = dataToStore;

            expect(cache.hasData).to.be.equal(true, 'Must have data');
            expect(cache.data).to.be.deep.equal(dataToStore);

            clearCache();
            expect(cache.hasData).to.be.equal(false, 'Must not have data');
            expect(cache.data).to.be.deep.equal(undefined, 'Must not have data');
        });
        test('Data is stored in cache must be cleared', () => {
            const pythonPath = 'Some Python Path';
            const vsc = createMockVSC(pythonPath);
            const resource = Uri.parse('a');
            const cache = new InMemoryInterpreterSpecificCache('Something', 10000, [resource], vsc);

            expect(cache.hasData).to.be.equal(false, 'Must not have any data');

            cache.data = dataToStore;

            expect(cache.hasData).to.be.equal(true, 'Must have data');
            expect(cache.data).to.be.deep.equal(dataToStore);

            cache.clear();
            expect(cache.hasData).to.be.equal(false, 'Must not have data');
            expect(cache.data).to.be.deep.equal(undefined, 'Must not have data');
        });
        test('Data is stored in cache and expired data is not returned', async () => {
            const pythonPath = 'Some Python Path';
            const vsc = createMockVSC(pythonPath);
            const resource = Uri.parse('a');
            const cache = new InMemoryInterpreterSpecificCache('Something', 100, [resource], vsc);

            expect(cache.hasData).to.be.equal(false, 'Must not have any data');
            cache.data = dataToStore;
            expect(cache.hasData).to.be.equal(true, 'Must have data');
            expect(cache.data).to.be.deep.equal(dataToStore);

            await sleep(10);
            expect(cache.hasData).to.be.equal(true, 'Must have data');
            expect(cache.data).to.be.deep.equal(dataToStore);

            await sleep(50);
            expect(cache.hasData).to.be.equal(true, 'Must have data');
            expect(cache.data).to.be.deep.equal(dataToStore);

            await sleep(110);
            expect(cache.hasData).to.be.equal(false, 'Must not have data');
            expect(cache.data).to.be.deep.equal(undefined, 'Must not have data');
        });
        test('Data is stored in cache (with workspaces)', () => {
            const pythonPath = 'Some Python Path';
            const vsc = createMockVSC(pythonPath);
            const resource = Uri.parse('a');
            (vsc.workspace as any).workspaceFolders = [{ index: 0, name: '1', uri: Uri.parse('wkfolder') }];
            vsc.workspace.getWorkspaceFolder = () => vsc.workspace.workspaceFolders![0];
            const cache = new InMemoryInterpreterSpecificCache('Something', 10000, [resource], vsc);

            expect(cache.hasData).to.be.equal(false, 'Must not have any data');

            cache.data = dataToStore;

            expect(cache.hasData).to.be.equal(true, 'Must have data');
            expect(cache.data).to.be.deep.equal(dataToStore);
        });
        test('Data is stored in cache and different resources point to same storage location (without workspaces)', () => {
            const pythonPath = 'Some Python Path';
            const vsc = createMockVSC(pythonPath);
            const resource = Uri.parse('a');
            const anotherResource = Uri.parse('b');
            const cache = new InMemoryInterpreterSpecificCache('Something', 10000, [resource], vsc);
            const cache2 = new InMemoryInterpreterSpecificCache('Something', 10000, [anotherResource], vsc);

            expect(cache.hasData).to.be.equal(false, 'Must not have any data');
            expect(cache2.hasData).to.be.equal(false, 'Must not have any data');

            cache.data = dataToStore;

            expect(cache.hasData).to.be.equal(true, 'Must have data');
            expect(cache2.hasData).to.be.equal(true, 'Must have data');
            expect(cache.data).to.be.deep.equal(dataToStore);
            expect(cache2.data).to.be.deep.equal(dataToStore);
        });
        test('Data is stored in cache and different resources point to same storage location (with workspaces)', () => {
            const pythonPath = 'Some Python Path';
            const vsc = createMockVSC(pythonPath);
            const resource = Uri.parse('a');
            const anotherResource = Uri.parse('b');
            (vsc.workspace as any).workspaceFolders = [{ index: 0, name: '1', uri: Uri.parse('wkfolder') }];
            vsc.workspace.getWorkspaceFolder = () => vsc.workspace.workspaceFolders![0];
            const cache = new InMemoryInterpreterSpecificCache('Something', 10000, [resource], vsc);
            const cache2 = new InMemoryInterpreterSpecificCache('Something', 10000, [anotherResource], vsc);

            expect(cache.hasData).to.be.equal(false, 'Must not have any data');
            expect(cache2.hasData).to.be.equal(false, 'Must not have any data');

            cache.data = dataToStore;

            expect(cache.hasData).to.be.equal(true, 'Must have data');
            expect(cache2.hasData).to.be.equal(true, 'Must have data');
            expect(cache.data).to.be.deep.equal(dataToStore);
            expect(cache2.data).to.be.deep.equal(dataToStore);
        });
        test('Data is stored in cache and different resources do not point to same storage location (with multiple workspaces)', () => {
            const pythonPath = 'Some Python Path';
            const vsc = createMockVSC(pythonPath);
            const resource = Uri.parse('a');
            const anotherResource = Uri.parse('b');
            (vsc.workspace as any).workspaceFolders = [
                { index: 0, name: '1', uri: Uri.parse('wkfolder1') },
                { index: 1, name: '2', uri: Uri.parse('wkfolder2') }
            ];
            vsc.workspace.getWorkspaceFolder = (res) => {
                const index = res.fsPath === resource.fsPath ? 0 : 1;
                return vsc.workspace.workspaceFolders![index];
            };
            const cache = new InMemoryInterpreterSpecificCache('Something', 10000, [resource], vsc);
            const cache2 = new InMemoryInterpreterSpecificCache('Something', 10000, [anotherResource], vsc);

            expect(cache.hasData).to.be.equal(false, 'Must not have any data');
            expect(cache2.hasData).to.be.equal(false, 'Must not have any data');

            cache.data = dataToStore;

            expect(cache.hasData).to.be.equal(true, 'Must have data');
            expect(cache2.hasData).to.be.equal(false, 'Must not have any data');
            expect(cache.data).to.be.deep.equal(dataToStore);
            expect(cache2.data).to.be.deep.equal(undefined, 'Must not have any data');

            cache2.data = 'Store some other data';

            expect(cache.hasData).to.be.equal(true, 'Must have data');
            expect(cache2.hasData).to.be.equal(true, 'Must have');
            expect(cache.data).to.be.deep.equal(dataToStore);
            expect(cache2.data).to.be.deep.equal('Store some other data', 'Must have data');
        });
    });
});
