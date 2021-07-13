// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert } from 'chai';
import * as path from 'path';
import { EventEmitter } from 'vscode';
import { PythonEnvKind } from '../../../../../client/pythonEnvironments/base/info';
import { PythonEnvsReducer } from '../../../../../client/pythonEnvironments/base/locators/composite/environmentsReducer';
import { PythonEnvsChangedEvent } from '../../../../../client/pythonEnvironments/base/watcher';
import { assertBasicEnvsEqual } from '../../../discovery/locators/envTestUtils';
import { createBasicEnv, getEnvs, getEnvsWithUpdates, SimpleLocator } from '../../common';
import { PythonEnvUpdatedEvent, BasicEnvInfo } from '../../../../../client/pythonEnvironments/base/locator';

suite('Python envs locator - Environments Reducer', () => {
    suite('iterEnvs()', () => {
        test('Iterator only yields unique environments', async () => {
            const env1 = createBasicEnv(PythonEnvKind.Venv, path.join('path', 'to', 'exec1'));
            const env2 = createBasicEnv(PythonEnvKind.Conda, path.join('path', 'to', 'exec2'));
            const env3 = createBasicEnv(PythonEnvKind.System, path.join('path', 'to', 'exec3'));
            const env4 = createBasicEnv(PythonEnvKind.Unknown, path.join('path', 'to', 'exec2')); // Same as env2
            const env5 = createBasicEnv(PythonEnvKind.Venv, path.join('path', 'to', 'exec1')); // Same as env1
            const environmentsToBeIterated = [env1, env2, env3, env4, env5]; // Contains 3 unique environments
            const parentLocator = new SimpleLocator(environmentsToBeIterated);
            const reducer = new PythonEnvsReducer(parentLocator);

            const iterator = reducer.iterEnvs();
            const envs = await getEnvs(iterator);

            const expected = [env1, env2, env3];
            assertBasicEnvsEqual(envs, expected);
        });

        test('Updates are applied correctly', async () => {
            const env1 = createBasicEnv(PythonEnvKind.Venv, path.join('path', 'to', 'exec1'));
            const env2 = createBasicEnv(PythonEnvKind.System, path.join('path', 'to', 'exec2'));
            const env3 = createBasicEnv(PythonEnvKind.Conda, path.join('path', 'to', 'exec2')); // Same as env2
            const env4 = createBasicEnv(PythonEnvKind.Unknown, path.join('path', 'to', 'exec2')); // Same as env2
            const env5 = createBasicEnv(PythonEnvKind.Poetry, path.join('path', 'to', 'exec1')); // Same as env1
            const env6 = createBasicEnv(PythonEnvKind.VirtualEnv, path.join('path', 'to', 'exec1')); // Same as env1
            const environmentsToBeIterated = [env1, env2, env3, env4, env5, env6]; // Contains 3 unique environments
            const parentLocator = new SimpleLocator(environmentsToBeIterated);
            const reducer = new PythonEnvsReducer(parentLocator);

            const iterator = reducer.iterEnvs();
            const envs = await getEnvsWithUpdates(iterator);

            const expected = [env5, env3];
            assertBasicEnvsEqual(envs, expected);
        });

        test('Updates to environments from the incoming iterator replaces the previous info', async () => {
            // Arrange
            const env = createBasicEnv(PythonEnvKind.Poetry, path.join('path', 'to', 'exec1'));
            const updatedEnv = createBasicEnv(PythonEnvKind.Venv, path.join('path', 'to', 'exec1'));
            const envsReturnedByParentLocator = [env];
            const didUpdate = new EventEmitter<PythonEnvUpdatedEvent<BasicEnvInfo> | null>();
            const parentLocator = new SimpleLocator<BasicEnvInfo>(envsReturnedByParentLocator, {
                onUpdated: didUpdate.event,
            });
            const reducer = new PythonEnvsReducer(parentLocator);

            // Act
            const iterator = reducer.iterEnvs();

            const iteratorUpdateCallback = () => {
                didUpdate.fire({ index: 0, old: env, update: updatedEnv });
                didUpdate.fire(null); // It is essential for the incoming iterator to fire "null" event signifying it's done
            };
            const envs = await getEnvsWithUpdates(iterator, iteratorUpdateCallback);

            // Assert
            assertBasicEnvsEqual(envs, [updatedEnv]);
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
});
