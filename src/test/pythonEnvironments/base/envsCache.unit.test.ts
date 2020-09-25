// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as sinon from 'sinon';
import { PythonEnvInfoCache } from '../../../client/pythonEnvironments/base/envsCache';
import { PythonEnvInfo, PythonEnvKind } from '../../../client/pythonEnvironments/base/info';
import * as externalDependencies from '../../../client/pythonEnvironments/common/externalDependencies';
import * as envInfo from '../../../client/pythonEnvironments/info';

suite('Environment Info cache', () => {
    let getGlobalPersistentStoreStub: sinon.SinonStub;
    let areSameEnvironmentStub: sinon.SinonStub;
    let updatedValues: PythonEnvInfo[] | undefined;

    const allEnvsComplete = () => true;
    const envInfoArray = [
        {
            kind: PythonEnvKind.Conda, name: 'my-conda-env', defaultDisplayName: 'env-one',
        },
        {
            kind: PythonEnvKind.Venv, name: 'my-venv-env', defaultDisplayName: 'env-two',
        },
        {
            kind: PythonEnvKind.Pyenv, name: 'my-pyenv-env', defaultDisplayName: 'env-three',
        },
    ] as PythonEnvInfo[];

    setup(() => {
        areSameEnvironmentStub = sinon.stub(envInfo, 'areSameEnvironment');
        areSameEnvironmentStub.callsFake(
            (env1: PythonEnvInfo, env2:PythonEnvInfo) => env1.name === env2.name,
        );

        getGlobalPersistentStoreStub = sinon.stub(externalDependencies, 'getGlobalPersistentStore');
        getGlobalPersistentStoreStub.returns({
            value: envInfoArray,
            updateValue: async (envs: PythonEnvInfo[]) => {
                updatedValues = envs;
                return Promise.resolve();
            },
        });
    });

    teardown(() => {
        getGlobalPersistentStoreStub.restore();
        areSameEnvironmentStub.restore();
        updatedValues = undefined;
    });

    test('`initialize` reads from persistent storage', () => {
        const envsCache = new PythonEnvInfoCache(allEnvsComplete);

        envsCache.initialize();

        assert.ok(getGlobalPersistentStoreStub.calledOnce);
    });

    test('The in-memory env info array is undefined if there is no value in persistent storage when initializing the cache', () => {
        const envsCache = new PythonEnvInfoCache(allEnvsComplete);

        getGlobalPersistentStoreStub.returns({ value: undefined });
        envsCache.initialize();
        const result = envsCache.getAllEnvs();

        assert.strictEqual(result, undefined);
    });

    test('`getAllEnvs` should return a deep copy of the environments currently in memory', () => {
        const envsCache = new PythonEnvInfoCache(allEnvsComplete);

        envsCache.initialize();
        const envs = envsCache.getAllEnvs()!;

        envs[0].name = 'some-other-name';

        assert.ok(envs[0] !== envInfoArray[0]);
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
        const env:PythonEnvInfo = { name: 'my-venv-env' } as unknown as PythonEnvInfo;
        const envsCache = new PythonEnvInfoCache(allEnvsComplete);

        envsCache.initialize();

        const result = envsCache.getEnv(env);

        assert.deepStrictEqual(result, {
            kind: PythonEnvKind.Venv, name: 'my-venv-env', defaultDisplayName: 'env-two',
        });
    });

    test('`getEnv` should return a deep copy of an environment', () => {
        const envToFind = {
            kind: PythonEnvKind.System, name: 'my-system-env', defaultDisplayName: 'env-system',
        } as unknown as PythonEnvInfo;
        const env:PythonEnvInfo = { name: 'my-system-env' } as unknown as PythonEnvInfo;
        const envsCache = new PythonEnvInfoCache(allEnvsComplete);

        envsCache.setAllEnvs([...envInfoArray, envToFind]);

        const result = envsCache.getEnv(env)!;
        result.name = 'some-other-name';

        assert.ok(result !== envToFind);
    });

    test('`getEnv` should return undefined if no environment matches the properties of its argument', () => {
        const env:PythonEnvInfo = { name: 'my-nonexistent-env' } as unknown as PythonEnvInfo;
        const envsCache = new PythonEnvInfoCache(allEnvsComplete);

        envsCache.initialize();

        const result = envsCache.getEnv(env);

        assert.strictEqual(result, undefined);
    });

    test('`flush` should write complete environment info objects to persistent storage', async () => {
        const otherEnv = {
            kind: PythonEnvKind.OtherGlobal,
            name: 'my-other-env',
            defaultDisplayName: 'env-five',
        };
        const updatedEnvInfoArray = [
            otherEnv, { kind: PythonEnvKind.System, name: 'my-system-env' },
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

    test('`flush` should not write to persistent storage if there are no environment info objects in-memory', async () => {
        const envsCache = new PythonEnvInfoCache((env) => env.kind === PythonEnvKind.MacDefault);

        await envsCache.flush();

        assert.strictEqual(updatedValues, undefined);
    });

    test('`flush` should not write to persistent storage if there are no complete environment info objects', async () => {
        const envsCache = new PythonEnvInfoCache((env) => env.kind === PythonEnvKind.MacDefault);

        envsCache.initialize();
        await envsCache.flush();

        assert.strictEqual(updatedValues, undefined);
    });
});
