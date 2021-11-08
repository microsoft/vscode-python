// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import { cloneDeep } from 'lodash';
import * as path from 'path';
import { EventEmitter, Uri } from 'vscode';
import { createDeferred, createDeferredFromPromise, sleep } from '../../../../../client/common/utils/async';
import { PythonEnvInfo } from '../../../../../client/pythonEnvironments/base/info';
import { buildEnvInfo } from '../../../../../client/pythonEnvironments/base/info/env';
import { PythonEnvUpdatedEvent } from '../../../../../client/pythonEnvironments/base/locator';
import {
    createCollectionCache,
    PythonEnvCompleteInfo,
} from '../../../../../client/pythonEnvironments/base/locators/composite/envsCollectionCache';
import { EnvsCollectionService } from '../../../../../client/pythonEnvironments/base/locators/composite/envsCollectionService';
import { noop } from '../../../../core';
import { TEST_LAYOUT_ROOT } from '../../../common/commonTestConstants';
import { SimpleLocator } from '../../common';
import { assertEnvEqual, assertEnvsEqual } from '../envTestUtils';

suite('Python envs locator - Environments Collection', async () => {
    let collectionService: EnvsCollectionService;
    let storage: PythonEnvInfo[];

    function createEnv(executable: string, searchLocation?: Uri, name?: string) {
        return buildEnvInfo({ executable, searchLocation, name });
    }

    function getLocatorEnvs() {
        const env1 = createEnv(path.join(TEST_LAYOUT_ROOT, 'conda1', 'python.exe'));
        const env2 = createEnv(
            path.join(TEST_LAYOUT_ROOT, 'pipenv', 'project1', '.venv', 'Scripts', 'python.exe'),
            Uri.file(TEST_LAYOUT_ROOT),
        );
        const env3 = createEnv(
            path.join(TEST_LAYOUT_ROOT, 'pyenv2', '.pyenv', 'pyenv-win', 'versions', '3.6.9', 'bin', 'python.exe'),
        );
        return [env1, env2, env3];
    }

    function getValidCachedEnvs() {
        const fakeLocalAppDataPath = path.join(TEST_LAYOUT_ROOT, 'storeApps');
        const envCached1 = createEnv(path.join(fakeLocalAppDataPath, 'Microsoft', 'WindowsApps', 'python.exe'));
        const envCached2 = createEnv(
            path.join(TEST_LAYOUT_ROOT, 'pipenv', 'project1', '.venv', 'Scripts', 'python.exe'),
            Uri.file(TEST_LAYOUT_ROOT),
        );
        return [envCached1, envCached2];
    }

    function getCachedEnvs() {
        const envCached3 = createEnv(path.join(TEST_LAYOUT_ROOT, 'doesNotExist')); // Invalid path, should not be reported.
        return [...getValidCachedEnvs(), envCached3];
    }

    function getExpectedEnvs() {
        const fakeLocalAppDataPath = path.join(TEST_LAYOUT_ROOT, 'storeApps');
        const envCached1 = createEnv(path.join(fakeLocalAppDataPath, 'Microsoft', 'WindowsApps', 'python.exe'));
        const env1 = createEnv(path.join(TEST_LAYOUT_ROOT, 'conda1', 'python.exe'), undefined, 'nameUpdated');
        const env2 = createEnv(
            path.join(TEST_LAYOUT_ROOT, 'pipenv', 'project1', '.venv', 'Scripts', 'python.exe'),
            Uri.file(TEST_LAYOUT_ROOT),
            'nameUpdated',
        );
        const env3 = createEnv(
            path.join(TEST_LAYOUT_ROOT, 'pyenv2', '.pyenv', 'pyenv-win', 'versions', '3.6.9', 'bin', 'python.exe'),
            undefined,
            'nameUpdated',
        );
        return [envCached1, env1, env2, env3].map((e: PythonEnvCompleteInfo) => {
            e.hasCompleteInfo = true;
            return e;
        });
    }

    setup(async () => {
        storage = [];
        const parentLocator = new SimpleLocator(getLocatorEnvs());
        const cache = await createCollectionCache({
            load: async () => getCachedEnvs(),
            store: async (envs) => {
                storage = envs;
            },
        });
        collectionService = new EnvsCollectionService(cache, parentLocator);
    });

    test('getEnvs() returns valid envs from cache', () => {
        const envs = collectionService.getEnvs();
        assertEnvsEqual(envs, getValidCachedEnvs());
    });

    test('getEnvs() uses query to filter envs before returning', () => {
        // Only query for environments which are not under any roots
        const envs = collectionService.getEnvs({ searchLocations: { roots: [] } });
        assertEnvsEqual(
            envs,
            getValidCachedEnvs().filter((e) => !e.searchLocation),
        );
    });

    test('triggerRefresh() refreshes the collection and storage with any new environments', async () => {
        const onUpdated = new EventEmitter<PythonEnvUpdatedEvent | null>();
        const locatedEnvs = getLocatorEnvs();
        const parentLocator = new SimpleLocator(locatedEnvs, {
            onUpdated: onUpdated.event,
            after: async () => {
                locatedEnvs.forEach((env, index) => {
                    const update = cloneDeep(env);
                    update.name = `nameUpdated`;
                    onUpdated.fire({ index, update });
                });
                onUpdated.fire(null);
            },
        });
        const cache = await createCollectionCache({
            load: async () => getCachedEnvs(),
            store: async (e) => {
                storage = e;
            },
        });
        collectionService = new EnvsCollectionService(cache, parentLocator);

        await collectionService.triggerRefresh();
        const envs = collectionService.getEnvs();

        const expected = getExpectedEnvs();
        assertEnvsEqual(envs, expected);
        assertEnvsEqual(storage, expected);
    });

    test('refreshPromise() correctly indicates the status of the refresh', async () => {
        const deferred = createDeferred();
        const parentLocator = new SimpleLocator(getLocatorEnvs(), { after: () => deferred.promise });
        const cache = await createCollectionCache({
            load: async () => getCachedEnvs(),
            store: async () => noop(),
        });
        collectionService = new EnvsCollectionService(cache, parentLocator);

        expect(collectionService.refreshPromise).to.equal(
            undefined,
            'Should be undefined if no refresh is currently going on',
        );

        const promise = collectionService.triggerRefresh();

        const onGoingRefreshPromise = collectionService.refreshPromise;
        expect(onGoingRefreshPromise).to.not.equal(undefined, 'Refresh triggered should be tracked');
        const onGoingRefreshPromiseDeferred = createDeferredFromPromise(onGoingRefreshPromise!);
        await sleep(1);
        expect(onGoingRefreshPromiseDeferred.resolved).to.equal(false);

        deferred.resolve();
        await promise;

        expect(collectionService.refreshPromise).to.equal(
            undefined,
            'Should be undefined if no refresh is currently going on',
        );
        expect(onGoingRefreshPromiseDeferred.resolved).to.equal(
            true,
            'Any previous refresh promises should be resolved when refresh is over',
        );
    });

    test('onRefreshStarted() fires if refresh is triggered ', async () => {
        let isFired = false;
        collectionService.onRefreshStart(() => {
            isFired = true;
        });
        collectionService.triggerRefresh().ignoreErrors();
        await sleep(1);
        expect(isFired).to.equal(true);
    });

    test('resolveEnv() uses cache if complete info is available', async () => {
        const resolvedViaLocator = buildEnvInfo({ executable: 'Resolved via locator' });
        const cachedEnvs = getCachedEnvs();
        const env: PythonEnvCompleteInfo = cachedEnvs[0];
        env.hasCompleteInfo = true; // Has complete info
        const parentLocator = new SimpleLocator([], {
            resolve: async (e: PythonEnvInfo) => {
                if (env.executable.filename === e.executable.filename) {
                    return resolvedViaLocator;
                }
                return undefined;
            },
        });
        const cache = await createCollectionCache({
            load: async () => cachedEnvs,
            store: async () => noop(),
        });
        collectionService = new EnvsCollectionService(cache, parentLocator);
        const resolved = await collectionService.resolveEnv(env.executable.filename);
        assertEnvEqual(resolved, env);
    });

    test('resolveEnv() uses underlying locator if cache does not have complete info for env', async () => {
        const resolvedViaLocator = buildEnvInfo({ executable: 'Resolved via locator' });
        const cachedEnvs = getCachedEnvs();
        const env: PythonEnvCompleteInfo = cachedEnvs[0];
        env.hasCompleteInfo = false; // Does not have complete info
        const parentLocator = new SimpleLocator([], {
            resolve: async (e: PythonEnvInfo) => {
                if (env.executable.filename === e.executable.filename) {
                    return resolvedViaLocator;
                }
                return undefined;
            },
        });
        const cache = await createCollectionCache({
            load: async () => cachedEnvs,
            store: async () => noop(),
        });
        collectionService = new EnvsCollectionService(cache, parentLocator);
        const resolved = await collectionService.resolveEnv(env.executable.filename);
        assertEnvEqual(resolved, resolvedViaLocator);
    });
});
