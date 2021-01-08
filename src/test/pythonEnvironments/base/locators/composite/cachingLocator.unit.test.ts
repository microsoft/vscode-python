// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as path from 'path';
import { Uri } from 'vscode';
import { createDeferred } from '../../../../../client/common/utils/async';
import { Disposables } from '../../../../../client/common/utils/resourceLifecycle';
import { PythonEnvInfoCache } from '../../../../../client/pythonEnvironments/base/envsCache';
import { PythonEnvInfo, PythonEnvKind } from '../../../../../client/pythonEnvironments/base/info';
import { CachingLocator } from '../../../../../client/pythonEnvironments/base/locators/composite/cachingLocator';
import { getEnvs } from '../../../../../client/pythonEnvironments/base/locatorUtils';
import { PythonEnvsChangedEvent } from '../../../../../client/pythonEnvironments/base/watcher';
import { createLocatedEnv, createNamedEnv, SimpleLocator } from '../../common';

const env1 = createNamedEnv('env1', '2.7.11', PythonEnvKind.System, '/usr/bin/python');
const env2 = createNamedEnv('env2', '3.8.1', PythonEnvKind.System, '/usr/bin/python3');
const env3 = createLocatedEnv('/a/b/c/env5', '3.8.1', PythonEnvKind.Pipenv);
env3.searchLocation = Uri.file(path.normalize('/a/b/c'));
const env4 = createLocatedEnv('/x/y/z/env3', '2.7.11', PythonEnvKind.Venv);
env4.searchLocation = Uri.file(path.normalize('/x/y/z'));
const env5 = createLocatedEnv('/x/y/z/env4', '3.8.1', PythonEnvKind.Venv);
env5.searchLocation = Uri.file(path.normalize('/x/y/z'));
const envs = [env1, env2, env3, env4, env5];

class FakeCache extends PythonEnvInfoCache {
    constructor(
        load: () => Promise<PythonEnvInfo[] | undefined>,
        store: (e: PythonEnvInfo[]) => Promise<void>,
        isComplete: (e: PythonEnvInfo) => boolean = () => true,
    ) {
        super({ load, store }, isComplete);
    }
}

suite('Python envs locator - CachingLocator', () => {
    const disposables = new Disposables();

    teardown(async () => {
        await disposables.dispose();
    });

    async function getInitializedLocator(
        initialEnvs: PythonEnvInfo[],
    ): Promise<[SimpleLocator, CachingLocator, PythonEnvInfoCache]> {
        const cache = new FakeCache(
            () => Promise.resolve(undefined),
            () => Promise.resolve(undefined),
        );
        const subLocator = new SimpleLocator(initialEnvs, {
            resolve: null,
        });
        const locator = new CachingLocator(cache, subLocator);
        disposables.push(locator);
        return [subLocator, locator, cache];
    }

    suite('onChanged', () => {
        test('propagated', async () => {
            const expected: PythonEnvsChangedEvent = {};
            const [subLocator, locator] = await getInitializedLocator([env2]);
            await getEnvs(locator.iterEnvs()); // Force an initial refresh.
            let changeEvent: PythonEnvsChangedEvent | undefined;
            const eventDeferred = createDeferred<void>();

            locator.onChanged((e) => {
                changeEvent = e;
                eventDeferred.resolve();
            });
            subLocator.fire({});
            await eventDeferred.promise;

            assert.deepEqual(changeEvent, expected);
        });
    });

    suite('iterEnvs()', () => {
        test('no query', async () => {
            const expected = envs;
            const [, locator] = await getInitializedLocator(envs);

            const iterator = locator.iterEnvs();
            const discovered = await getEnvs(iterator);

            assert.deepEqual(discovered, expected);
        });

        test('filter kinds', async () => {
            const expected = [env1, env2, env4, env5];
            const [, locator] = await getInitializedLocator(envs);
            const query = {
                kinds: [PythonEnvKind.Venv, PythonEnvKind.System],
            };

            const iterator = locator.iterEnvs(query);
            const discovered = await getEnvs(iterator);

            assert.deepEqual(discovered, expected);
        });

        test('filter locations', async () => {
            const expected = [env4, env5];
            const query = {
                searchLocations: {
                    roots: [Uri.file(path.normalize('/x/y/z'))],
                },
            };
            const [, locator] = await getInitializedLocator(envs);

            const iterator = locator.iterEnvs(query);
            const discovered = await getEnvs(iterator);

            assert.deepEqual(discovered, expected);
        });

        test('cache empty', async () => {
            const [, locator] = await getInitializedLocator([]);

            const iterator = locator.iterEnvs();
            const discovered = await getEnvs(iterator);

            assert.deepEqual(discovered, []);
        });
    });

    suite('resolveEnv()', () => {
        test('full match in cache', async () => {
            const expected = env5;
            const [, locator] = await getInitializedLocator(envs);

            const resolved = await locator.resolveEnv(env5);

            assert.deepEqual(resolved, expected);
        });

        test('executable match in cache', async () => {
            const expected = env5;
            const [, locator] = await getInitializedLocator(envs);

            const resolved = await locator.resolveEnv(env5.executable.filename);

            assert.deepEqual(resolved, expected);
        });

        test('not in cache but found downstream', async () => {
            const expected = env5;
            const [subLocator, locator] = await getInitializedLocator([]);
            subLocator.callbacks.resolve = () => Promise.resolve(env5);

            const iterator1 = locator.iterEnvs();
            const discoveredBefore = await getEnvs(iterator1);
            const resolved = await locator.resolveEnv(env5);
            const iterator2 = locator.iterEnvs();
            const discoveredAfter = await getEnvs(iterator2);

            assert.deepEqual(resolved, expected);
            assert.deepEqual(discoveredBefore, []);
            assert.deepEqual(discoveredAfter, [env5]);
        });

        test('not in cache initially, added to cache when fetching downstream, and also found downstream', async () => {
            const expected = env5;
            const [subLocator, locator, cache] = await getInitializedLocator([]);
            subLocator.callbacks.resolve = () => {
                cache.setAllEnvs([env5]);
                return Promise.resolve(env5);
            };

            const iterator1 = locator.iterEnvs();
            const discoveredBefore = await getEnvs(iterator1);
            const resolved = await locator.resolveEnv(env5);
            const iterator2 = locator.iterEnvs();
            const discoveredAfter = await getEnvs(iterator2);

            assert.deepEqual(resolved, expected);
            assert.deepEqual(discoveredBefore, []);
            // Verify the same env isn't iterated twice
            assert.deepEqual(discoveredAfter, [env5]);
        });

        test('not in cache nor downstream', async () => {
            const [, locator] = await getInitializedLocator([]);

            const resolved = await locator.resolveEnv(env5);

            assert.equal(resolved, undefined);
        });
    });
});
