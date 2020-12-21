// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import { getPersistentCache, PythonEnvInfoCache } from '../../../client/pythonEnvironments/base/envsCache';
import { PythonEnvInfo, PythonEnvKind } from '../../../client/pythonEnvironments/base/info';

const allEnvsComplete = () => true;

const envInfoArray = [
    {
        kind: PythonEnvKind.Conda,
        executable: { filename: 'my-conda-env' },
    },
    {
        kind: PythonEnvKind.Venv,
        executable: { filename: 'my-venv-env' },
    },
    {
        kind: PythonEnvKind.Pyenv,
        executable: { filename: 'my-pyenv-env' },
    },
] as PythonEnvInfo[];

suite('Environment Info cache', () => {
    let loadedValues: PythonEnvInfo[] | undefined;
    let updatedValues: PythonEnvInfo[] | undefined;

    function getGlobalPersistentStore() {
        return {
            load: () => {
                const values = loadedValues;
                loadedValues = undefined;
                return Promise.resolve(values);
            },
            store: (envs: PythonEnvInfo[]) => {
                updatedValues = envs;
                return Promise.resolve();
            },
        };
    }

    setup(() => {
        loadedValues = envInfoArray;
        updatedValues = undefined;
    });

    test('`reset` reads from persistent storage', async () => {
        const envsCache = new PythonEnvInfoCache(getGlobalPersistentStore(), allEnvsComplete);

        await envsCache.clearAndReloadFromStorage();

        assert.equal(loadedValues, undefined);
    });

    test('The in-memory env info array is undefined if there is no value in persistent storage when initializing the cache', async () => {
        const envsCache = new PythonEnvInfoCache(getGlobalPersistentStore(), allEnvsComplete);

        loadedValues = undefined;
        const result = envsCache.getAllEnvs();

        assert.strictEqual(result, undefined);
    });

    test('`getAllEnvs` should return a deep copy of the environments currently in memory', async () => {
        const envsCache = await getPersistentCache(getGlobalPersistentStore(), allEnvsComplete);

        const envs = envsCache.getAllEnvs()!;

        envs[0].name = 'some-other-name';

        assert.ok(envs[0] !== envInfoArray[0]);
    });

    test('`getAllEnvs` should return undefined if nothing has been set', () => {
        const envsCache = new PythonEnvInfoCache(getGlobalPersistentStore(), allEnvsComplete);

        const envs = envsCache.getAllEnvs();

        assert.deepStrictEqual(envs, undefined);
    });

    test('`setAllEnvs` should clone the environment info array passed as a parameter', () => {
        const envsCache = new PythonEnvInfoCache(getGlobalPersistentStore(), allEnvsComplete);

        envsCache.setAllEnvs(envInfoArray);
        const envs = envsCache.getAllEnvs();

        assert.deepStrictEqual(envs, envInfoArray);
        assert.strictEqual(envs === envInfoArray, false);
    });

    test('`filterEnvs` should return environments that match its argument using areSameEnvironmnet', async () => {
        const env: PythonEnvInfo = ({ executable: { filename: 'my-venv-env' } } as unknown) as PythonEnvInfo;
        const envsCache = await getPersistentCache(getGlobalPersistentStore(), allEnvsComplete);

        const result = envsCache.filterEnvs(env);

        assert.deepStrictEqual(result, [
            {
                kind: PythonEnvKind.Venv,
                executable: { filename: 'my-venv-env' },
            },
        ]);
    });

    test('`filterEnvs` should return a deep copy of the matched environments', () => {
        const envToFind = ({
            kind: PythonEnvKind.System,
            executable: { filename: 'my-system-env' },
        } as unknown) as PythonEnvInfo;
        const env: PythonEnvInfo = ({ executable: { filename: 'my-system-env' } } as unknown) as PythonEnvInfo;
        const envsCache = new PythonEnvInfoCache(getGlobalPersistentStore(), allEnvsComplete);

        envsCache.setAllEnvs([...envInfoArray, envToFind]);

        const result = envsCache.filterEnvs(env)!;
        result[0].name = 'some-other-name';

        assert.notDeepStrictEqual(result[0], envToFind);
    });

    test('`filterEnvs` should return an empty array if no environment matches the properties of its argument', async () => {
        const env: PythonEnvInfo = ({ executable: { filename: 'my-nonexistent-env' } } as unknown) as PythonEnvInfo;
        const envsCache = await getPersistentCache(getGlobalPersistentStore(), allEnvsComplete);

        const result = envsCache.filterEnvs(env);

        assert.deepStrictEqual(result, []);
    });

    test("`filterEnvs` should return undefined if the cache hasn't been activated", () => {
        const env: PythonEnvInfo = ({ executable: { filename: 'my-nonexistent-env' } } as unknown) as PythonEnvInfo;
        const envsCache = new PythonEnvInfoCache(getGlobalPersistentStore(), allEnvsComplete);

        const result = envsCache.filterEnvs(env);

        assert.strictEqual(result, undefined);
    });

    test('`flush` should write complete environment info objects to persistent storage', async () => {
        const otherEnv = {
            kind: PythonEnvKind.OtherGlobal,
            executable: { filename: 'my-other-env' },
            defaultDisplayName: 'other-env',
        };
        const updatedEnvInfoArray = [
            otherEnv,
            { kind: PythonEnvKind.System, executable: { filename: 'my-system-env' } },
        ] as PythonEnvInfo[];
        const expected = [otherEnv];
        const envsCache = await getPersistentCache(
            getGlobalPersistentStore(),
            (env) => env.defaultDisplayName !== undefined,
        );

        envsCache.setAllEnvs(updatedEnvInfoArray);
        await envsCache.flush();

        assert.deepStrictEqual(updatedValues, expected);
    });

    test('`flush` should not write to persistent storage if there are no environment info objects in-memory', async () => {
        const envsCache = await getPersistentCache(
            getGlobalPersistentStore(),
            (env) => env.kind === PythonEnvKind.MacDefault,
        );

        await envsCache.flush();

        assert.strictEqual(updatedValues, undefined);
    });

    test('`flush` should not write to persistent storage if there are no complete environment info objects', async () => {
        const envsCache = await getPersistentCache(
            getGlobalPersistentStore(),
            (env) => env.kind === PythonEnvKind.MacDefault,
        );

        await envsCache.flush();

        assert.strictEqual(updatedValues, undefined);
    });
});
