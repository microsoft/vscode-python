// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert, expect } from 'chai';
import { cloneDeep } from 'lodash';
import * as path from 'path';
import { EventEmitter } from 'vscode';
import { Architecture } from '../../../../../client/common/utils/platform';
import { PythonEnvInfo, PythonEnvKind } from '../../../../../client/pythonEnvironments/base/info';
import { buildEnvInfo } from '../../../../../client/pythonEnvironments/base/info/env';
import { parseVersion } from '../../../../../client/pythonEnvironments/base/info/pythonVersion';
import { PythonEnvUpdatedEvent } from '../../../../../client/pythonEnvironments/base/locator';
import { ResolvingLocator } from '../../../../../client/pythonEnvironments/base/locators/composite/resolvingLocator';
import { PythonEnvsChangedEvent } from '../../../../../client/pythonEnvironments/base/watcher';
import { sleep } from '../../../../core';
import { createNamedEnv, getEnvs, SimpleLocator } from '../../common';

function buildToolEnvInfo(spec: {
    executable: string;
    sysPrefix: string;
    version: string;
    sysVersion: string;
    is64Bit: boolean;
}): PythonEnvInfo {
    const env = buildEnvInfo({
        executable: spec.executable,
        version: parseVersion(spec.version),
    });
    env.version.sysVersion = spec.sysVersion;
    env.executable.sysPrefix = spec.sysPrefix;
    env.arch = spec.is64Bit ? Architecture.x64 : Architecture.x86;
    return env;
}

function getEnvInfoFunc(
    spec: {
        sysPrefix: string;
        version: string;
        sysVersion: string;
        is64Bit: boolean;
    } | null,
): (p: string) => Promise<PythonEnvInfo | undefined> {
    if (spec === null) {
        return (_e: string) => Promise.resolve(undefined);
    }
    return (executable: string) => {
        const env = buildToolEnvInfo({ executable, ...spec });
        return Promise.resolve(env);
    };
}

function failIfUsed(_p: string): Promise<PythonEnvInfo | undefined> {
    throw Error('this should not have been called!');
}

suite('Python envs locator - ResolvingLocator', () => {
    /**
     * Returns the expected environment to be returned by Environment info service
     */
    function createExpectedEnvInfo(env: PythonEnvInfo): PythonEnvInfo {
        const updatedEnv = cloneDeep(env);
        updatedEnv.version = {
            ...parseVersion('3.8.3-final'),
            sysVersion: '3.8.3 (tags/v3.8.3:6f8c832, May 13 2020, 22:37:02) [MSC v.1924 64 bit (AMD64)]',
        };
        updatedEnv.executable.filename = env.executable.filename;
        updatedEnv.executable.sysPrefix = 'path';
        updatedEnv.arch = Architecture.x64;
        return updatedEnv;
    }

    suite('iterEnvs()', () => {
        test('Iterator yields environments as-is', async () => {
            const env1 = createNamedEnv('env1', '3.5.12b1', PythonEnvKind.Venv, path.join('path', 'to', 'exec1'));
            const env2 = createNamedEnv('env2', '3.8.1', PythonEnvKind.Conda, path.join('path', 'to', 'exec2'));
            const env3 = createNamedEnv('env3', '2.7', PythonEnvKind.System, path.join('path', 'to', 'exec3'));
            const env4 = createNamedEnv('env4', '3.9.0rc2', PythonEnvKind.Unknown, path.join('path', 'to', 'exec2'));
            const environmentsToBeIterated = [env1, env2, env3, env4];
            const parentLocator = new SimpleLocator(environmentsToBeIterated);
            const getEnvInfo = getEnvInfoFunc({
                sysPrefix: 'path',
                version: '3.8.3',
                sysVersion: '3.8.3 (tags/v3.8.3:6f8c832, May 13 2020, 22:37:02) [MSC v.1924 64 bit (AMD64)]',
                is64Bit: true,
            });;
            const resolver = new ResolvingLocator(parentLocator, getEnvInfo);

            const iterator = resolver.iterEnvs();
            const envs = await getEnvs(iterator);

            assert.deepEqual(envs, environmentsToBeIterated);
        });

        test('Updates for environments are sent correctly followed by the null event', async () => {
            // Arrange
            const env1 = createNamedEnv('env1', '3.5.12b1', PythonEnvKind.Unknown, path.join('path', 'to', 'exec1'));
            const env2 = createNamedEnv('env2', '3.8.1', PythonEnvKind.Unknown, path.join('path', 'to', 'exec2'));
            const environmentsToBeIterated = [env1, env2];
            const parentLocator = new SimpleLocator(environmentsToBeIterated);
            const onUpdatedEvents: (PythonEnvUpdatedEvent | null)[] = [];
            const getEnvInfo = getEnvInfoFunc({
                sysPrefix: 'path',
                version: '3.8.3',
                sysVersion: '3.8.3 (tags/v3.8.3:6f8c832, May 13 2020, 22:37:02) [MSC v.1924 64 bit (AMD64)]',
                is64Bit: true,
            });;
            const resolver = new ResolvingLocator(parentLocator, getEnvInfo);

            const iterator = resolver.iterEnvs(); // Act

            // Assert
            let { onUpdated } = iterator;
            expect(onUpdated).to.not.equal(undefined, '');

            // Arrange
            onUpdated = onUpdated!;
            onUpdated((e) => {
                onUpdatedEvents.push(e);
            });

            // Act
            await getEnvs(iterator);
            await sleep(1); // Resolve pending calls in the background

            // Assert
            const expectedUpdates = [
                { index: 0, old: env1, update: createExpectedEnvInfo(env1) },
                { index: 1, old: env2, update: createExpectedEnvInfo(env2) },
                null,
            ];
            assert.deepEqual(onUpdatedEvents, expectedUpdates);
        });

        test('Updates to environments from the incoming iterator are sent correctly followed by the null event', async () => {
            // Arrange
            const env = createNamedEnv('env1', '3.8', PythonEnvKind.Unknown, path.join('path', 'to', 'exec'));
            const updatedEnv = createNamedEnv('env1', '3.8.1', PythonEnvKind.System, path.join('path', 'to', 'exec'));
            const environmentsToBeIterated = [env];
            const didUpdate = new EventEmitter<PythonEnvUpdatedEvent | null>();
            const parentLocator = new SimpleLocator(environmentsToBeIterated, { onUpdated: didUpdate.event });
            const onUpdatedEvents: (PythonEnvUpdatedEvent | null)[] = [];
            const getEnvInfo = getEnvInfoFunc({
                sysPrefix: 'path',
                version: '3.8.3',
                sysVersion: '3.8.3 (tags/v3.8.3:6f8c832, May 13 2020, 22:37:02) [MSC v.1924 64 bit (AMD64)]',
                is64Bit: true,
            });;
            const resolver = new ResolvingLocator(parentLocator, getEnvInfo);

            const iterator = resolver.iterEnvs(); // Act

            // Assert
            let { onUpdated } = iterator;
            expect(onUpdated).to.not.equal(undefined, '');

            // Arrange
            onUpdated = onUpdated!;
            onUpdated((e) => {
                onUpdatedEvents.push(e);
            });

            // Act
            await getEnvs(iterator);
            await sleep(1);
            didUpdate.fire({ index: 0, old: env, update: updatedEnv });
            didUpdate.fire(null); // It is essential for the incoming iterator to fire "null" event signifying it's done
            await sleep(1);

            // Assert
            // The updates can be anything, even the number of updates, but they should lead to the same final state
            const { length } = onUpdatedEvents;
            assert.deepEqual(
                onUpdatedEvents[length - 2]?.update,
                createExpectedEnvInfo(updatedEnv),
                'The final update to environment is incorrect',
            );
            assert.equal(onUpdatedEvents[length - 1], null, 'Last update should be null');
            didUpdate.dispose();
        });
    });

    test('onChanged fires iff onChanged from parent fires', () => {
        const parentLocator = new SimpleLocator([]);
        const event1: PythonEnvsChangedEvent = {};
        const event2: PythonEnvsChangedEvent = { kind: PythonEnvKind.Unknown };
        const expected = [event1, event2];
        const resolver = new ResolvingLocator(parentLocator, failIfUsed);

        const events: PythonEnvsChangedEvent[] = [];
        resolver.onChanged((e) => events.push(e));

        parentLocator.fire(event1);
        parentLocator.fire(event2);

        assert.deepEqual(events, expected);
    });

    suite('resolveEnv()', () => {
        test('Calls into parent locator to get resolved environment, then calls environnment service to resolve environment further and return it', async () => {
            const env = createNamedEnv('env1', '3.8', PythonEnvKind.Unknown, path.join('path', 'to', 'exec'));
            const resolvedEnvReturnedByReducer = createNamedEnv(
                'env1',
                '3.8.1',
                PythonEnvKind.Conda,
                'resolved/path/to/exec',
            );
            const parentLocator = new SimpleLocator([], {
                resolve: async (e: PythonEnvInfo) => {
                    if (e === env) {
                        return resolvedEnvReturnedByReducer;
                    }
                    throw new Error('Incorrect environment sent to the resolver');
                },
            });
            const getEnvInfo = getEnvInfoFunc({
                sysPrefix: 'path',
                version: '3.8.3',
                sysVersion: '3.8.3 (tags/v3.8.3:6f8c832, May 13 2020, 22:37:02) [MSC v.1924 64 bit (AMD64)]',
                is64Bit: true,
            });
            const resolver = new ResolvingLocator(parentLocator, getEnvInfo);

            const expected = await resolver.resolveEnv(env);

            assert.deepEqual(expected, createExpectedEnvInfo(resolvedEnvReturnedByReducer));
        });

        test('If the parent locator resolves environment, but fetching interpreter info returns undefined, return undefined', async () => {
            const env = createNamedEnv('env1', '3.8', PythonEnvKind.Unknown, path.join('path', 'to', 'exec'));
            const resolvedEnvReturnedByReducer = createNamedEnv(
                'env1',
                '3.8.1',
                PythonEnvKind.Conda,
                'resolved/path/to/exec',
            );
            const parentLocator = new SimpleLocator([], {
                resolve: async (e: PythonEnvInfo) => {
                    if (e === env) {
                        return resolvedEnvReturnedByReducer;
                    }
                    throw new Error('Incorrect environment sent to the resolver');
                },
            });
            const getEnvInfo = getEnvInfoFunc(null);
            const resolver = new ResolvingLocator(parentLocator, getEnvInfo);

            const expected = await resolver.resolveEnv(env);

            assert.deepEqual(expected, undefined);
        });

        test("If the parent locator isn't able to resolve environment, return undefined", async () => {
            const env = createNamedEnv('env', '3.8', PythonEnvKind.Unknown, path.join('path', 'to', 'exec'));
            const parentLocator = new SimpleLocator([], {
                resolve: async () => undefined,
            });
            const getEnvInfo = getEnvInfoFunc(null);
            const resolver = new ResolvingLocator(parentLocator, getEnvInfo);

            const expected = await resolver.resolveEnv(env);

            assert.deepEqual(expected, undefined);
        });
    });
});
