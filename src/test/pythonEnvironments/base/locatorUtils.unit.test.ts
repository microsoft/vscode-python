// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as path from 'path';
import { EventEmitter, Uri } from 'vscode';
import { getValues as getEnumValues } from '../../../client/common/utils/enum';
import { PythonEnvInfo, PythonEnvKind } from '../../../client/pythonEnvironments/base/info';
import { copyEnvInfo } from '../../../client/pythonEnvironments/base/info/env';
import {
    IPythonEnvsIterator,
    PythonEnvUpdatedEvent,
    PythonLocatorQuery,
} from '../../../client/pythonEnvironments/base/locator';
import { getEnvs, getQueryFilter } from '../../../client/pythonEnvironments/base/locatorUtils';
import {
    createEnv,
    createLocatedEnv,
    fixPath,
} from './common';

const homeDir = fixPath('/home/me');
const workspaceRoot = Uri.file('workspace-root');
const doesNotExist = Uri.file(fixPath('does-not-exist'));

function setSearchLocation(env: PythonEnvInfo, location?: string): void {
    const locationStr = location === undefined
        ? path.dirname(env.location)
        : fixPath(location);
    env.searchLocation = Uri.file(locationStr);
}

const env1 = createEnv('env1', '3.8', PythonEnvKind.System, '/usr/bin/python3.8');
const env2 = createEnv('env2', '3.8.1rc2', PythonEnvKind.Pyenv, '/pyenv/3.8.1rc2/bin/python');
const env3 = createEnv('env3', '3.9.1b2', PythonEnvKind.Unknown, 'python3.9');
const env4 = createEnv('env4', '2.7.11', PythonEnvKind.Pyenv, '/pyenv/2.7.11/bin/python');
const env5 = createEnv('env5', '2.7', PythonEnvKind.System, 'python2');
const env6 = createEnv('env6', '3.7.4', PythonEnvKind.Conda, 'python');
const plainEnvs = [env1, env2, env3, env4, env5, env6];

const envL1 = createLocatedEnv('/.venvs/envL1', '3.9.0', PythonEnvKind.Venv);
const envL2 = createLocatedEnv('/conda/envs/envL2', '3.8.3', PythonEnvKind.Conda);
const locatedEnvs = [envL1, envL2];

const envS1 = createEnv('env S1', '3.9', PythonEnvKind.OtherVirtual, `${homeDir}/some-dir/bin/python`);
setSearchLocation(envS1, homeDir);
const envS2 = createEnv('env S2', '3.9', PythonEnvKind.OtherVirtual, `${homeDir}/some-dir2/bin/python`);
setSearchLocation(envS2, homeDir);
const rootedEnvs = [envS1, envS2];

const envSL1 = createLocatedEnv(`${homeDir}/.venvs/envSL1`, '3.9.0', PythonEnvKind.Venv);
setSearchLocation(envSL1);
const envSL2 = createLocatedEnv(`${workspaceRoot.fsPath}/.venv`, '3.8.2', PythonEnvKind.Pipenv);
setSearchLocation(envSL2);
const envSL3 = createLocatedEnv(`${homeDir}/.conda-envs/envSL3`, '3.8.2', PythonEnvKind.Conda);
setSearchLocation(envSL3);
const envSL4 = createLocatedEnv('/opt/python3.10', '3.10.0a1', PythonEnvKind.Custom);
setSearchLocation(envSL4);
const envSL5 = createLocatedEnv(`${homeDir}/.venvs/envSL5`, '3.9.0', PythonEnvKind.Venv);
setSearchLocation(envSL5);
const rootedLocatedEnvs = [envSL1, envSL2, envSL3, envSL4, envSL5];

const envs = [
    ...plainEnvs,
    ...locatedEnvs,
    ...rootedEnvs,
    ...rootedLocatedEnvs,
];

suite('Python envs locator utils - getQueryFilter', () => {
    suite('empty query', () => {
        const queries: PythonLocatorQuery[] = [
            {},
            { kinds: [] },
            { searchLocations: [] },
            { kinds: [], searchLocations: [] },
        ];
        queries.forEach((query) => {
            test(`all envs kept (query ${query})`, () => {
                const filter = getQueryFilter(query);
                const filtered = envs.filter(filter);

                assert.deepEqual(filtered, envs);
            });
        });
    });

    suite('kinds', () => {
        test('match none', () => {
            const query: PythonLocatorQuery = { kinds: [PythonEnvKind.MacDefault] };

            const filter = getQueryFilter(query);
            const filtered = envs.filter(filter);

            assert.deepEqual(filtered, []);
        });

        ([
            [PythonEnvKind.Unknown, [env3]],
            [PythonEnvKind.System, [env1, env5]],
            [PythonEnvKind.WindowsStore, []],
            [PythonEnvKind.Pyenv, [env2, env4]],
            [PythonEnvKind.Venv, [envL1, envSL1, envSL5]],
            [PythonEnvKind.Conda, [env6, envL2, envSL3]],
        ] as [PythonEnvKind, PythonEnvInfo[]][]).forEach(([kind, expected]) => {
            test(`match some (one kind: ${kind})`, () => {
                const query: PythonLocatorQuery = { kinds: [kind] };

                const filter = getQueryFilter(query);
                const filtered = envs.filter(filter);

                assert.deepEqual(filtered, expected);
            });
        });

        test('match some (many kinds)', () => {
            const expected = [env6, envL1, envL2, envSL1, envSL2, envSL3, envSL4, envSL5];
            const kinds = [
                PythonEnvKind.Venv,
                PythonEnvKind.VirtualEnv,
                PythonEnvKind.Pipenv,
                PythonEnvKind.Conda,
                PythonEnvKind.Custom,
            ];
            const query: PythonLocatorQuery = { kinds };

            const filter = getQueryFilter(query);
            const filtered = envs.filter(filter);

            assert.deepEqual(filtered, expected);
        });

        test('match all', () => {
            const kinds: PythonEnvKind[] = getEnumValues(PythonEnvKind);
            const query: PythonLocatorQuery = { kinds };

            const filter = getQueryFilter(query);
            const filtered = envs.filter(filter);

            assert.deepEqual(filtered, envs);
        });
    });

    suite('searchLocations', () => {
        test('match none', () => {
            const query: PythonLocatorQuery = { searchLocations: [doesNotExist] };

            const filter = getQueryFilter(query);
            const filtered = envs.filter(filter);

            assert.deepEqual(filtered, []);
        });

        test('match one (multiple locations)', () => {
            const expected = [envSL4];
            const searchLocations = [
                envSL4.searchLocation!,
                doesNotExist,
                envSL4.searchLocation!, // repeated
            ];
            const query: PythonLocatorQuery = { searchLocations };

            const filter = getQueryFilter(query);
            const filtered = envs.filter(filter);

            assert.deepEqual(filtered, expected);
        });

        test('match multiple (one location)', () => {
            const expected = [envS1, envS2];
            const searchLocations = [
                envS1.searchLocation!,
            ];
            const query: PythonLocatorQuery = { searchLocations };

            const filter = getQueryFilter(query);
            const filtered = envs.filter(filter);

            assert.deepEqual(filtered, expected);
        });

        test('match multiple (multiple locations)', () => {
            const expected = rootedLocatedEnvs;
            const searchLocations = rootedLocatedEnvs.map((env) => env.searchLocation!);
            searchLocations.push(doesNotExist);
            const query: PythonLocatorQuery = { searchLocations };

            const filter = getQueryFilter(query);
            const filtered = envs.filter(filter);

            assert.deepEqual(filtered, expected);
        });

        test('match all', () => {
            const expected = [...rootedEnvs, ...rootedLocatedEnvs];
            const searchLocations = expected.map((env) => env.searchLocation!);
            const query: PythonLocatorQuery = { searchLocations };

            const filter = getQueryFilter(query);
            const filtered = envs.filter(filter);

            assert.deepEqual(filtered, expected);
        });
    });

    suite('mixed query', () => {
        test('match none', () => {
            const query: PythonLocatorQuery = {
                kinds: [PythonEnvKind.OtherGlobal],
                searchLocations: [doesNotExist],
            };

            const filter = getQueryFilter(query);
            const filtered = envs.filter(filter);

            assert.deepEqual(filtered, []);
        });

        test('match some', () => {
            const expected = [envSL1, envSL4, envSL5];
            const kinds = [PythonEnvKind.Venv, PythonEnvKind.Custom];
            const searchLocations = rootedLocatedEnvs.map((env) => env.searchLocation!);
            searchLocations.push(doesNotExist);
            const query: PythonLocatorQuery = { kinds, searchLocations };

            const filter = getQueryFilter(query);
            const filtered = envs.filter(filter);

            assert.deepEqual(filtered, expected);
        });

        test('match all', () => {
            const expected = [...rootedEnvs, ...rootedLocatedEnvs];
            const kinds: PythonEnvKind[] = getEnumValues(PythonEnvKind);
            const searchLocations = expected.map((env) => env.searchLocation!);
            const query: PythonLocatorQuery = { kinds, searchLocations };

            const filter = getQueryFilter(query);
            const filtered = envs.filter(filter);

            assert.deepEqual(filtered, expected);
        });
    });
});

suite('Python envs locator utils - getEnvs', () => {
    test('empty, no update emitter', async () => {
        const iterator = (async function* () {
            // Yield nothing.
        }()) as IPythonEnvsIterator;

        const result = await getEnvs(iterator);

        assert.deepEqual(result, []);
    });

    test('empty, with unused update emitter', async () => {
        const emitter = new EventEmitter<PythonEnvUpdatedEvent | null>();
        // eslint-disable-next-line require-yield
        const iterator = (async function* () {
            // Yield nothing.
            emitter.fire(null);
        }()) as IPythonEnvsIterator;
        iterator.onUpdated = emitter.event;

        const result = await getEnvs(iterator);

        assert.deepEqual(result, []);
    });

    test('yield one, no update emitter', async () => {
        const iterator = (async function* () {
            yield env1;
        }()) as IPythonEnvsIterator;

        const result = await getEnvs(iterator);

        assert.deepEqual(result, [env1]);
    });

    test('yield one, no update', async () => {
        const emitter = new EventEmitter<PythonEnvUpdatedEvent | null>();
        const iterator = (async function* () {
            yield env1;
            emitter.fire(null);
        }()) as IPythonEnvsIterator;
        iterator.onUpdated = emitter.event;

        const result = await getEnvs(iterator);

        assert.deepEqual(result, [env1]);
    });

    test('yield one, with update', async () => {
        const expected = [envSL2];
        const old = copyEnvInfo(envSL2, { kind: PythonEnvKind.Venv });
        const emitter = new EventEmitter<PythonEnvUpdatedEvent | null>();
        const iterator = (async function* () {
            yield old;
            emitter.fire({ old, new: envSL2 });
            emitter.fire(null);
        }()) as IPythonEnvsIterator;
        iterator.onUpdated = emitter.event;

        const result = await getEnvs(iterator);

        assert.deepEqual(result, expected);
    });

    test('yield many, no update emitter', async () => {
        const expected = rootedLocatedEnvs;
        const iterator = (async function* () {
            yield* expected;
        }()) as IPythonEnvsIterator;

        const result = await getEnvs(iterator);

        assert.deepEqual(result, expected);
    });

    test('yield many, none updated', async () => {
        const expected = rootedLocatedEnvs;
        const emitter = new EventEmitter<PythonEnvUpdatedEvent | null>();
        const iterator = (async function* () {
            yield* expected;
            emitter.fire(null);
        }()) as IPythonEnvsIterator;
        iterator.onUpdated = emitter.event;

        const result = await getEnvs(iterator);

        assert.deepEqual(result, expected);
    });

    test('yield many, some updated', async () => {
        const expected = rootedLocatedEnvs;
        const emitter = new EventEmitter<PythonEnvUpdatedEvent | null>();
        const iterator = (async function* () {
            const kind = PythonEnvKind.Unknown;
            const original = [...expected];
            original[1] = copyEnvInfo(expected[1], { kind });
            original[2] = copyEnvInfo(expected[2], { kind });
            original[4] = copyEnvInfo(expected[4], { kind });

            yield* original;
            emitter.fire({ old: original[1], new: expected[1] });
            emitter.fire({ old: original[2], new: expected[2] });
            emitter.fire({ old: original[4], new: expected[4] });
            emitter.fire(null);
        }()) as IPythonEnvsIterator;
        iterator.onUpdated = emitter.event;

        const result = await getEnvs(iterator);

        assert.deepEqual(result, expected);
    });

    test('yield many, all updated', async () => {
        return;
        const expected = rootedLocatedEnvs;
        const emitter = new EventEmitter<PythonEnvUpdatedEvent | null>();
        const iterator = (async function* () {
            const kind = PythonEnvKind.Unknown;
            const original = expected.map((env) => copyEnvInfo(env, { kind }));

            yield original[0];
            yield original[1];
            emitter.fire({ old: original[0], new: expected[0] });
            yield* original.slice(2);
            original.slice(1).forEach((old, index) => {
                emitter.fire({ old, new: expected[index] });
            });
            emitter.fire(null);
        }()) as IPythonEnvsIterator;
        iterator.onUpdated = emitter.event;

        const result = await getEnvs(iterator);

        assert.deepEqual(result, expected);
    });
});
