// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as sinon from 'sinon';
import { CompleteEnvInfoFunction, PythonEnvInfoCache } from '../../../client/pythonEnvironments/base/envsCache';
import { PythonEnvInfo, PythonEnvKind } from '../../../client/pythonEnvironments/base/info';
import * as externalDeps from '../../../client/pythonEnvironments/common/externalDependencies';

suite('Environment Info cache', () => {
    let createGlobalPersistentStoreStub: sinon.SinonStub;
    let updatedValues: PythonEnvInfo[] = [];

    const allEnvsComplete: CompleteEnvInfoFunction = () => true;
    const envInfoArray = [
        {
            id: 'someid1', kind: PythonEnvKind.Conda, name: 'my-conda-env', defaultDisplayName: 'env-one',
        },
        {
            id: 'someid2', kind: PythonEnvKind.Venv, name: 'my-venv-env', defaultDisplayName: 'env-two',
        },
        {
            id: 'someid3', kind: PythonEnvKind.Pyenv, name: 'my-pyenv-env', defaultDisplayName: 'env-three',
        },
    ] as PythonEnvInfo[];

    setup(() => {
        createGlobalPersistentStoreStub = sinon.stub(externalDeps, 'createGlobalPersistentStore');
        createGlobalPersistentStoreStub.returns({
            value: envInfoArray,
            updateValue: async (envs: PythonEnvInfo[]) => {
                updatedValues = envs;
                return Promise.resolve();
            },
        });
    });

    teardown(() => {
        createGlobalPersistentStoreStub.restore();
        updatedValues = [];
    });

    test('`initialize` reads from persistent storage', () => {
        const envsCache = new PythonEnvInfoCache(allEnvsComplete);

        envsCache.initialize();

        assert.ok(createGlobalPersistentStoreStub.calledOnce);
    });

    test('`getAllEnvs` should return undefined if nothing has been set', () => {
        const envsCache = new PythonEnvInfoCache(allEnvsComplete);

        const envs = envsCache.getAllEnvs();

        assert.deepStrictEqual(envs, undefined);
    });

    test('`setAllEnvs` should clone the environment info array passed as a parameter', () => {
        const envsCache = new PythonEnvInfoCache(allEnvsComplete);

        envsCache.setAllEnvs(envInfoArray);
        const envs = envsCache.getAllEnvs();

        assert.deepStrictEqual(envs, envInfoArray);
        assert.strictEqual(envs === envInfoArray, false);
    });

    test('`getEnv` should return an environment that matches all non-undefined properties of its argument', () => {
        const envsCache = new PythonEnvInfoCache(allEnvsComplete);
        envsCache.initialize();

        const result = envsCache.getEnv({ name: 'my-venv-env' });

        assert.deepStrictEqual(result, {
            id: 'someid2', kind: PythonEnvKind.Venv, name: 'my-venv-env', defaultDisplayName: 'env-two',
        });
    });

    test('`getEnv` should return undefined if no environment matches the properties of its argument', () => {
        const envsCache = new PythonEnvInfoCache(allEnvsComplete);
        envsCache.initialize();

        const result = envsCache.getEnv({ name: 'my-nonexistent-env' });

        assert.strictEqual(result, undefined);
    });

    test('`flush` should write complete environment info objects to persistent storage', async () => {
        const otherEnv = {
            id: 'someid5',
            kind: PythonEnvKind.OtherGlobal,
            name: 'my-other-env',
            defaultDisplayName: 'env-five',
        };
        const updatedEnvInfoArray = [
            otherEnv, { id: 'someid4', kind: PythonEnvKind.System, name: 'my-system-env' },
        ] as PythonEnvInfo[];
        const expected = [
            otherEnv,
        ];
        const envsCache = new PythonEnvInfoCache((env) => env.defaultDisplayName !== undefined);

        envsCache.initialize();
        envsCache.setAllEnvs(updatedEnvInfoArray);
        await envsCache.flush();

        assert.deepStrictEqual(updatedValues, expected);
    });

    test('`flush` should not write to persistent storage if there are no complete environment info objects', async () => {
        const envsCache = new PythonEnvInfoCache((env) => env.kind === PythonEnvKind.MacDefault);

        envsCache.initialize();
        await envsCache.flush();

        assert.deepStrictEqual(updatedValues, []);
    });
});
