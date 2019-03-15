// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { Uri } from 'vscode';
import { clearCache, InMemoryInterpreterSpecificCache } from '../../../client/common/utils/cacheUtils';
import { sleep } from '../../core';

type CacheUtilsTestScenario = {
    scenarioDesc: string;
    // tslint:disable-next-line:no-any
    dataToStore: any;
};

const scenariosToTest: CacheUtilsTestScenario[] = [
    {
        scenarioDesc: 'simple string',
        dataToStore: 'hello'
    },
    {
        scenarioDesc: 'undefined',
        dataToStore: undefined
    },
    {
        scenarioDesc: 'object',
        dataToStore: { date: new Date(), hello: 1234 }
    }
];

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
    scenariosToTest.forEach((scenario: CacheUtilsTestScenario) => {
        test(`Data is stored in cache (without workspaces): ${scenario.scenarioDesc}`, () => {
            const pythonPath = 'Some Python Path';
            const vsc = createMockVSC(pythonPath);
            const resource = Uri.parse('a');
            const cache = new InMemoryInterpreterSpecificCache('Something', 10000, [resource], vsc);

            expect(cache.hasData).to.be.equal(false, 'Must not have any data');

            cache.data = scenario.dataToStore;

            expect(cache.hasData).to.be.equal(true, 'Must have data');
            expect(cache.data).to.be.deep.equal(scenario.dataToStore);
        });
        test(`Data is stored in cache must be cleared when clearing globally: ${scenario.scenarioDesc}`, () => {
            const pythonPath = 'Some Python Path';
            const vsc = createMockVSC(pythonPath);
            const resource = Uri.parse('a');
            const cache = new InMemoryInterpreterSpecificCache('Something', 10000, [resource], vsc);

            expect(cache.hasData).to.be.equal(false, 'Must not have any data');

            cache.data = scenario.dataToStore;

            expect(cache.hasData).to.be.equal(true, 'Must have data');
            expect(cache.data).to.be.deep.equal(scenario.dataToStore);

            clearCache();
            expect(cache.hasData).to.be.equal(false, 'Must not have data');
            expect(cache.data).to.be.deep.equal(undefined, 'Must not have data');
        });
        test(`Data is stored in cache must be cleared: ${scenario.scenarioDesc}`, () => {
            const pythonPath = 'Some Python Path';
            const vsc = createMockVSC(pythonPath);
            const resource = Uri.parse('a');
            const cache = new InMemoryInterpreterSpecificCache('Something', 10000, [resource], vsc);

            expect(cache.hasData).to.be.equal(false, 'Must not have any data');

            cache.data = scenario.dataToStore;

            expect(cache.hasData).to.be.equal(true, 'Must have data');
            expect(cache.data).to.be.deep.equal(scenario.dataToStore);

            cache.clear();
            expect(cache.hasData).to.be.equal(false, 'Must not have data');
            expect(cache.data).to.be.deep.equal(undefined, 'Must not have data');
        });
        test(`Data is stored in cache and expired data is not returned: ${scenario.scenarioDesc}`, async () => {
            const pythonPath = 'Some Python Path';
            const vsc = createMockVSC(pythonPath);
            const resource = Uri.parse('a');
            const cache = new InMemoryInterpreterSpecificCache('Something', 100, [resource], vsc);

            expect(cache.hasData).to.be.equal(false, 'Must not have any data before caching.');
            cache.data = scenario.dataToStore;
            expect(cache.hasData).to.be.equal(true, 'Must have data after setting the first time.');
            expect(cache.data).to.be.deep.equal(scenario.dataToStore);

            await sleep(10);
            expect(cache.hasData).to.be.equal(true, 'Must have data after waiting for 10ms');
            expect(cache.data).to.be.deep.equal(scenario.dataToStore);

            await sleep(50);
            expect(cache.hasData).to.be.equal(true, 'Must have data after waiting 50ms');
            expect(cache.data).to.be.deep.equal(scenario.dataToStore);

            await sleep(110);
            expect(cache.hasData).to.be.equal(false, 'Must not have data after waiting 110ms');
            expect(cache.data).to.be.deep.equal(undefined, 'Must not have data stored after waiting for the specified timeout.');
        });
        test(`Data is stored in cache (with workspaces): ${scenario.scenarioDesc}`, () => {
            const pythonPath = 'Some Python Path';
            const vsc = createMockVSC(pythonPath);
            const resource = Uri.parse('a');
            (vsc.workspace as any).workspaceFolders = [{ index: 0, name: '1', uri: Uri.parse('wkfolder') }];
            vsc.workspace.getWorkspaceFolder = () => vsc.workspace.workspaceFolders![0];
            const cache = new InMemoryInterpreterSpecificCache('Something', 10000, [resource], vsc);

            expect(cache.hasData).to.be.equal(false, 'Must not have any data');

            cache.data = scenario.dataToStore;

            expect(cache.hasData).to.be.equal(true, 'Must have data');
            expect(cache.data).to.be.deep.equal(scenario.dataToStore);
        });
        test(`Data is stored in cache and different resources point to same storage location (without workspaces): ${scenario.scenarioDesc}`, () => {
            const pythonPath = 'Some Python Path';
            const vsc = createMockVSC(pythonPath);
            const resource = Uri.parse('a');
            const anotherResource = Uri.parse('b');
            const cache = new InMemoryInterpreterSpecificCache('Something', 10000, [resource], vsc);
            const cache2 = new InMemoryInterpreterSpecificCache('Something', 10000, [anotherResource], vsc);

            expect(cache.hasData).to.be.equal(false, 'Must not have any data');
            expect(cache2.hasData).to.be.equal(false, 'Must not have any data');

            cache.data = scenario.dataToStore;

            expect(cache.hasData).to.be.equal(true, 'Must have data');
            expect(cache2.hasData).to.be.equal(true, 'Must have data');
            expect(cache.data).to.be.deep.equal(scenario.dataToStore);
            expect(cache2.data).to.be.deep.equal(scenario.dataToStore);
        });
        test(`Data is stored in cache and different resources point to same storage location (with workspaces): ${scenario.scenarioDesc}`, () => {
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

            cache.data = scenario.dataToStore;

            expect(cache.hasData).to.be.equal(true, 'Must have data');
            expect(cache2.hasData).to.be.equal(true, 'Must have data');
            expect(cache.data).to.be.deep.equal(scenario.dataToStore);
            expect(cache2.data).to.be.deep.equal(scenario.dataToStore);
        });
        test(`Data is stored in cache and different resources do not point to same storage location (with multiple workspaces): ${scenario.scenarioDesc}`, () => {
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

            cache.data = scenario.dataToStore;

            expect(cache.hasData).to.be.equal(true, 'Must have data');
            expect(cache2.hasData).to.be.equal(false, 'Must not have any data');
            expect(cache.data).to.be.deep.equal(scenario.dataToStore);
            expect(cache2.data).to.be.deep.equal(undefined, 'Must not have any data');

            cache2.data = 'Store some other data';

            expect(cache.hasData).to.be.equal(true, 'Must have data');
            expect(cache2.hasData).to.be.equal(true, 'Must have');
            expect(cache.data).to.be.deep.equal(scenario.dataToStore);
            expect(cache2.data).to.be.deep.equal('Store some other data', 'Must have data');
        });
    });
});
