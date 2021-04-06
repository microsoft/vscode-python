// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert, expect } from 'chai';
import { isEqual } from 'lodash';
import * as path from 'path';
import { EventEmitter } from 'vscode';
import { PythonEnvInfo, PythonEnvKind } from '../../../../../client/pythonEnvironments/base/info';
import { PythonEnvUpdatedEvent } from '../../../../../client/pythonEnvironments/base/locator';
import { PythonEnvsReducer } from '../../../../../client/pythonEnvironments/base/locators/composite/environmentsReducer';
import { PythonEnvsChangedEvent } from '../../../../../client/pythonEnvironments/base/watcher';
import { sleep } from '../../../../core';
import { createNamedEnv, getEnvs, SimpleLocator } from '../../common';

suite('Python envs locator - Environments Reducer', () => {
    suite('iterEnvs()', () => {
        test('Iterator only yields unique environments', async () => {
            const env1 = createNamedEnv('env1', '3.5', PythonEnvKind.Venv, path.join('path', 'to', 'exec1'));
            const env2 = createNamedEnv('env2', '3.8', PythonEnvKind.Conda, path.join('path', 'to', 'exec2'));
            const env3 = createNamedEnv('env3', '2.7', PythonEnvKind.System, path.join('path', 'to', 'exec3'));
            const env4 = createNamedEnv('env4', '3.8.1', PythonEnvKind.Unknown, path.join('path', 'to', 'exec2')); // Same as env2
            const env5 = createNamedEnv('env5', '3.5.12b1', PythonEnvKind.Venv, path.join('path', 'to', 'exec1')); // Same as env1
            const environmentsToBeIterated = [env1, env2, env3, env4, env5]; // Contains 3 unique environments
            const parentLocator = new SimpleLocator(environmentsToBeIterated);
            const reducer = new PythonEnvsReducer(parentLocator);

            const iterator = reducer.iterEnvs();
            const envs = await getEnvs(iterator);

            const expected = [env1, env2, env3];
            assert.deepEqual(envs, expected);
        });

        test('Single updates for multiple environments are sent correctly followed by the null event', async () => {
            // Arrange
            const env1 = createNamedEnv('env15', '3.5.12b1', PythonEnvKind.Unknown, path.join('path', 'to', 'exec1'));
            const env2 = createNamedEnv(
                'env24',
                '3.8',
                PythonEnvKind.Unknown,
                {
                    filename: path.join('path', 'to', 'folder', 'python3.8'),
                    ctime: 15,
                    mtime: -1,
                    sysPrefix: '',
                },
                {
                    org: 'OrgName',
                    defaultDisplayName: 'Default name',
                },
            );
            const env3 = createNamedEnv('env3', '2.7', PythonEnvKind.System, path.join('path', 'to', 'exec3'));
            const env4 = createNamedEnv(
                '',
                '3.8.1',
                PythonEnvKind.Conda,
                {
                    filename: path.join('path', 'to', 'folder', 'python'),
                    ctime: -1,
                    mtime: 15,
                    sysPrefix: 'sysPrefix',
                },
                {
                    org: 'Some other orgName',
                    binDir: 'path/to/binDir',
                    version: {
                        raw: 'Raw version',
                        major: 3,
                        minor: -1,
                        micro: 2,
                    },
                },
            ); // Same as env2
            const env5 = createNamedEnv('env15', '3.5', PythonEnvKind.Venv, path.join('path', 'to', 'exec1')); // Same as env1;
            const environmentsToBeIterated = [env1, env2, env3, env4, env5]; // Contains 3 unique environments
            const parentLocator = new SimpleLocator(environmentsToBeIterated);
            const onUpdatedEvents: (PythonEnvUpdatedEvent | null)[] = [];
            const reducer = new PythonEnvsReducer(parentLocator);

            const iterator = reducer.iterEnvs(); // Act

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
            // Note merged env is constructed picking the better fields from the two envs.
            // For eg. the merge for env2 & env4 should be,
            const env24 = createNamedEnv(
                // Pick name from env2
                'env24',
                // Choose version from env4
                '3.8.1',
                // Choose type from env4
                PythonEnvKind.Conda,
                {
                    // Choose file info from env2
                    filename: path.join('path', 'to', 'folder', 'python3.8'),
                    ctime: 15,
                    mtime: -1,
                    // Choose sysPrefix from env4
                    sysPrefix: 'sysPrefix',
                },
                // Choose distro info from env2
                {
                    org: 'OrgName',
                    defaultDisplayName: 'Default name',
                },
            );
            const env15 = createNamedEnv('env15', '3.5.12b1', PythonEnvKind.Venv, path.join('path', 'to', 'exec1'));
            const expectedUpdates = [
                { index: 1, old: env2, update: env24 },
                { index: 0, old: env1, update: env15 },
                null,
            ];
            assert.deepEqual(expectedUpdates, onUpdatedEvents);
        });

        test('Multiple updates for the same environment are sent correctly followed by the null event', async () => {
            // Arrange
            const env1 = createNamedEnv('env123', '3.8', PythonEnvKind.Unknown, path.join('path', 'to', 'exec'));
            const env2 = createNamedEnv('env123', '3.8.1', PythonEnvKind.System, path.join('path', 'to', 'exec'));
            const env3 = createNamedEnv('env123', '3.8', PythonEnvKind.Conda, path.join('path', 'to', 'exec'));
            const environmentsToBeIterated = [env1, env2, env3]; // All refer to the same environment
            const parentLocator = new SimpleLocator(environmentsToBeIterated);
            const onUpdatedEvents: (PythonEnvUpdatedEvent | null)[] = [];
            const reducer = new PythonEnvsReducer(parentLocator);

            const iterator = reducer.iterEnvs(); // Act

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
            const env12 = createNamedEnv('env123', '3.8.1', PythonEnvKind.System, path.join('path', 'to', 'exec'));
            const env123 = createNamedEnv('env123', '3.8.1', PythonEnvKind.Conda, path.join('path', 'to', 'exec'));
            const expectedUpdates: (PythonEnvUpdatedEvent | null)[] = [];
            if (isEqual(env12, env123)) {
                expectedUpdates.push({ index: 0, old: env1, update: env12 }, null);
            } else {
                expectedUpdates.push(
                    { index: 0, old: env1, update: env12 },
                    { index: 0, old: env12, update: env123 },
                    null,
                );
            }
            assert.deepEqual(onUpdatedEvents, expectedUpdates);
        });

        test('Updates to environments from the incoming iterator are passed on correctly followed by the null event', async () => {
            // Arrange
            const env1 = createNamedEnv('env12', '3.8.1', PythonEnvKind.Unknown, path.join('path', 'to', 'exec'));
            const env2 = createNamedEnv('env12', '3.8', PythonEnvKind.System, path.join('path', 'to', 'exec'));
            const environmentsToBeIterated = [env1];
            const didUpdate = new EventEmitter<PythonEnvUpdatedEvent | null>();
            const parentLocator = new SimpleLocator(environmentsToBeIterated, { onUpdated: didUpdate.event });
            const onUpdatedEvents: (PythonEnvUpdatedEvent | null)[] = [];
            const reducer = new PythonEnvsReducer(parentLocator);

            const iterator = reducer.iterEnvs(); // Act

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
            didUpdate.fire({ index: 0, old: env1, update: env2 });
            didUpdate.fire(null); // It is essential for the incoming iterator to fire "null" event signifying it's done
            await sleep(1);

            // Assert
            const env12 = createNamedEnv('env12', '3.8.1', PythonEnvKind.System, path.join('path', 'to', 'exec'));
            const expectedUpdates = [{ index: 0, old: env1, update: env12 }, null];
            assert.deepEqual(expectedUpdates, onUpdatedEvents);
            didUpdate.dispose();
        });
    });

    test('onChanged fires iff onChanged from locator manager fires', () => {
        const parentLocator = new SimpleLocator([]);
        const event1: PythonEnvsChangedEvent = {};
        const event2: PythonEnvsChangedEvent = { kind: PythonEnvKind.Unknown };
        const expected = [event1, event2];
        const reducer = new PythonEnvsReducer(parentLocator);

        const events: PythonEnvsChangedEvent[] = [];
        reducer.onChanged((e) => events.push(e));

        parentLocator.fire(event1);
        parentLocator.fire(event2);

        assert.deepEqual(events, expected);
    });

    suite('resolveEnv()', () => {
        test('Iterates environments from the reducer to get resolved environment, then calls into locator manager to resolve environment further and return it', async () => {
            const env1 = createNamedEnv('env', '3.8', PythonEnvKind.Conda, path.join('path', 'to', 'exec'));
            const env2 = createNamedEnv('env2', '2.7', PythonEnvKind.System, path.join('path', 'to', 'exec3'));
            const env3 = createNamedEnv('env', '3.8.1b1', PythonEnvKind.System, path.join('path', 'to', 'exec'));
            const env4 = createNamedEnv('env4', '3.8.1', PythonEnvKind.Conda, path.join('path', 'to', 'exec2'));
            const env5 = createNamedEnv('env5', '3.5.12b1', PythonEnvKind.Venv, path.join('path', 'to', 'exec1'));
            const env6 = createNamedEnv('env', '3.8.1', PythonEnvKind.Unknown, path.join('path', 'to', 'exec'));
            const environmentsToBeIterated = [env1, env2, env3, env4, env5, env6]; // env1 env3 env6 are same

            const env136 = createNamedEnv('env', '3.8.1b1', PythonEnvKind.Conda, path.join('path', 'to', 'exec'));
            const expected = createNamedEnv('resolvedEnv', '3.8.1', PythonEnvKind.Conda, 'resolved/path/to/exec');
            const parentLocator = new SimpleLocator(environmentsToBeIterated, {
                resolve: async (e: PythonEnvInfo) => {
                    if (isEqual(e, env136)) {
                        return expected;
                    }
                    throw new Error('Incorrect environment sent to the resolve');
                },
            });
            const reducer = new PythonEnvsReducer(parentLocator);

            // Trying to resolve the environment corresponding to env1 env3 env6
            const resolved = await reducer.resolveEnv(path.join('path', 'to', 'exec'));

            assert.deepEqual(resolved, expected);
        });

        test("If the reducer isn't able to resolve environment, fall back to the wrapped locator", async () => {
            const env1 = createNamedEnv('env', '3.8', PythonEnvKind.Conda, path.join('path', 'to', 'exec'));
            const env2 = createNamedEnv('env2', '2.7', PythonEnvKind.System, path.join('path', 'to', 'exec3'));
            const env3 = createNamedEnv('env', '3.8.1b1', PythonEnvKind.System, path.join('path', 'to', 'exec'));
            const env4 = createNamedEnv('env4', '3.8.1', PythonEnvKind.Conda, path.join('path', 'to', 'exec2'));
            const env5 = createNamedEnv('env5', '3.5.12b1', PythonEnvKind.Venv, path.join('path', 'to', 'exec1'));
            const env6 = createNamedEnv('env', '3.8.1', PythonEnvKind.Unknown, path.join('path', 'to', 'exec'));
            const environmentsToBeIterated = [env1, env2, env3, env4, env5, env6]; // env1 env3 env6 are same

            const filename1 = path.join('resolved', 'path', 'to', 'execNeverSeenBefore');
            const filename2 = path.join('resolved', 'path', 'to', 'execAlsoNeverSeenBefore');
            const expected = createNamedEnv('resolvedEnv', '3.8.1', PythonEnvKind.Conda, filename1);
            const parentLocator = new SimpleLocator(environmentsToBeIterated, {
                resolve: async (e: PythonEnvInfo) => {
                    if (e.executable.filename === expected.executable.filename) {
                        return expected;
                    }
                    return undefined;
                },
            });
            const reducer = new PythonEnvsReducer(parentLocator);

            const resolved1 = await reducer.resolveEnv(filename1);
            const resolved2 = await reducer.resolveEnv(filename2);

            assert.deepEqual(resolved1, expected);
            assert.equal(resolved2, undefined);
        });
    });
});
