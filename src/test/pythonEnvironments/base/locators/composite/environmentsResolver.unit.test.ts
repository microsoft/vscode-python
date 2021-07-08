// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert, expect } from 'chai';
import { cloneDeep } from 'lodash';
import * as path from 'path';
import * as sinon from 'sinon';
import { ImportMock } from 'ts-mock-imports';
import { EventEmitter, Uri } from 'vscode';
import { ExecutionResult } from '../../../../../client/common/process/types';
import { IDisposableRegistry } from '../../../../../client/common/types';
import { Architecture } from '../../../../../client/common/utils/platform';
import * as platformApis from '../../../../../client/common/utils/platform';
import {
    PythonEnvInfo,
    PythonEnvKind,
    PythonEnvSource,
    PythonVersion,
    UNKNOWN_PYTHON_VERSION,
} from '../../../../../client/pythonEnvironments/base/info';
import { parseVersion } from '../../../../../client/pythonEnvironments/base/info/pythonVersion';
import { PythonEnvUpdatedEvent } from '../../../../../client/pythonEnvironments/base/locator';
import { PythonEnvsResolver } from '../../../../../client/pythonEnvironments/base/locators/composite/environmentsResolver';
import { getEnvs as getEnvsWithUpdates } from '../../../../../client/pythonEnvironments/base/locatorUtils';
import { PythonEnvsChangedEvent } from '../../../../../client/pythonEnvironments/base/watcher';
import * as ExternalDep from '../../../../../client/pythonEnvironments/common/externalDependencies';
import {
    getEnvironmentInfoService,
    IEnvironmentInfoService,
} from '../../../../../client/pythonEnvironments/info/environmentInfoService';
import { sleep } from '../../../../core';
import { TEST_LAYOUT_ROOT } from '../../../common/commonTestConstants';
import { assertEnvEqual } from '../../../discovery/locators/envTestUtils';
import { createNamedEnv, getEnvs, SimpleLocator } from '../../common';

suite('Python envs locator - Environments Resolver', () => {
    let envInfoService: IEnvironmentInfoService;
    let disposables: IDisposableRegistry;

    setup(() => {
        disposables = [];
        envInfoService = getEnvironmentInfoService(disposables);
    });
    teardown(() => {
        sinon.restore();
        disposables.forEach((d) => d.dispose());
    });

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
        let stubShellExec: sinon.SinonStub;
        setup(() => {
            stubShellExec = ImportMock.mockFunction(
                ExternalDep,
                'shellExecute',
                new Promise<ExecutionResult<string>>((resolve) => {
                    resolve({
                        stdout:
                            '{"versionInfo": [3, 8, 3, "final", 0], "sysPrefix": "path", "sysVersion": "3.8.3 (tags/v3.8.3:6f8c832, May 13 2020, 22:37:02) [MSC v.1924 64 bit (AMD64)]", "is64Bit": true}',
                    });
                }),
            );
        });

        teardown(() => {
            stubShellExec.restore();
        });

        test('Iterator yields environments as-is', async () => {
            const env1 = createNamedEnv('env1', '3.5.12b1', PythonEnvKind.Venv, path.join('path', 'to', 'exec1'));
            const env2 = createNamedEnv('env2', '3.8.1', PythonEnvKind.Conda, path.join('path', 'to', 'exec2'));
            const env3 = createNamedEnv('env3', '2.7', PythonEnvKind.System, path.join('path', 'to', 'exec3'));
            const env4 = createNamedEnv('env4', '3.9.0rc2', PythonEnvKind.Unknown, path.join('path', 'to', 'exec2'));
            const environmentsToBeIterated = [env1, env2, env3, env4];
            const parentLocator = new SimpleLocator(environmentsToBeIterated);
            const resolver = new PythonEnvsResolver(parentLocator, envInfoService);

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
            const resolver = new PythonEnvsResolver(parentLocator, envInfoService);

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

        test('If fetching interpreter info fails, it is not reported in the final list of envs', async () => {
            // Arrange
            stubShellExec.returns(
                new Promise<ExecutionResult<string>>((resolve) => {
                    resolve({
                        stderr: 'Kaboom',
                        stdout: '',
                    });
                }),
            );
            const env1 = createNamedEnv('env1', '3.5.12b1', PythonEnvKind.Unknown, path.join('path', 'to', 'exec1'));
            const env2 = createNamedEnv('env2', '3.8.1', PythonEnvKind.Unknown, path.join('path', 'to', 'exec2'));
            const environmentsToBeIterated = [env1, env2];
            const parentLocator = new SimpleLocator(environmentsToBeIterated);
            const resolver = new PythonEnvsResolver(parentLocator, envInfoService);

            // Act
            const iterator = resolver.iterEnvs();
            const envs = await getEnvsWithUpdates(iterator);

            // Assert
            assert.deepEqual(envs, []);
        });

        test('Updates to environments from the incoming iterator are sent correctly followed by the null event', async () => {
            // Arrange
            const env = createNamedEnv('env1', '3.8', PythonEnvKind.Unknown, path.join('path', 'to', 'exec'));
            const updatedEnv = createNamedEnv('env1', '3.8.1', PythonEnvKind.System, path.join('path', 'to', 'exec'));
            const environmentsToBeIterated = [env];
            const didUpdate = new EventEmitter<PythonEnvUpdatedEvent | null>();
            const parentLocator = new SimpleLocator(environmentsToBeIterated, { onUpdated: didUpdate.event });
            const onUpdatedEvents: (PythonEnvUpdatedEvent | null)[] = [];
            const resolver = new PythonEnvsResolver(parentLocator, envInfoService);

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

    test('onChanged fires iff onChanged from resolver fires', () => {
        const parentLocator = new SimpleLocator([]);
        const event1: PythonEnvsChangedEvent = {};
        const event2: PythonEnvsChangedEvent = { kind: PythonEnvKind.Unknown };
        const expected = [event1, event2];
        const resolver = new PythonEnvsResolver(parentLocator, envInfoService);

        const events: PythonEnvsChangedEvent[] = [];
        resolver.onChanged((e) => events.push(e));

        parentLocator.fire(event1);
        parentLocator.fire(event2);

        assert.deepEqual(events, expected);
    });

    suite('resolveEnv()', () => {
        let stubShellExec: sinon.SinonStub;
        const testVirtualHomeDir = path.join(TEST_LAYOUT_ROOT, 'virtualhome');
        function createExpectedResolvedEnvInfo(
            interpreterPath: string,
            kind: PythonEnvKind,
            version: PythonVersion = UNKNOWN_PYTHON_VERSION,
            name = '',
            location = '',
        ): PythonEnvInfo {
            return {
                name,
                location,
                kind,
                executable: {
                    filename: interpreterPath,
                    sysPrefix: '',
                    ctime: -1,
                    mtime: -1,
                },
                display: undefined,
                version,
                arch: Architecture.Unknown,
                distro: { org: '' },
                searchLocation: Uri.file(path.dirname(location)),
                source: [PythonEnvSource.Other],
            };
        }
        setup(() => {
            sinon.stub(platformApis, 'getOSType').callsFake(() => platformApis.OSType.Windows);
            stubShellExec = ImportMock.mockFunction(
                ExternalDep,
                'shellExecute',
                new Promise<ExecutionResult<string>>((resolve) => {
                    resolve({
                        stdout:
                            '{"versionInfo": [3, 8, 3, "final", 0], "sysPrefix": "path", "sysVersion": "3.8.3 (tags/v3.8.3:6f8c832, May 13 2020, 22:37:02) [MSC v.1924 64 bit (AMD64)]", "is64Bit": true}',
                    });
                }),
            );
            sinon.stub(ExternalDep, 'getWorkspaceFolders').returns([testVirtualHomeDir]);
        });

        teardown(() => {
            stubShellExec.restore();
        });

        test('Calls into basic resolver to get environment info, then calls environnment service to resolve environment further and return it', async () => {
            const resolvedEnvReturnedByBasicResolver = createExpectedResolvedEnvInfo(
                path.join(testVirtualHomeDir, '.venvs', 'win1', 'python.exe'),
                PythonEnvKind.Venv,
                undefined,
                'win1',
                path.join(testVirtualHomeDir, '.venvs', 'win1'),
            );
            const parentLocator = new SimpleLocator([]);
            const resolver = new PythonEnvsResolver(parentLocator, envInfoService);

            const expected = await resolver.resolveEnv(path.join(testVirtualHomeDir, '.venvs', 'win1', 'python.exe'));

            assertEnvEqual(expected, createExpectedEnvInfo(resolvedEnvReturnedByBasicResolver));
        });

        test('If running interpreter info throws error, return undefined', async () => {
            stubShellExec.returns(
                new Promise<ExecutionResult<string>>((_resolve, reject) => {
                    reject();
                }),
            );
            const parentLocator = new SimpleLocator([]);
            const resolver = new PythonEnvsResolver(parentLocator, envInfoService);

            const expected = await resolver.resolveEnv(path.join(testVirtualHomeDir, '.venvs', 'win1', 'python.exe'));

            assert.deepEqual(expected, undefined);
        });

        test('If fetching interpreter info fails with stderr, return undefined', async () => {
            stubShellExec.returns(
                new Promise<ExecutionResult<string>>((resolve) => {
                    resolve({
                        stderr: 'Kaboom',
                        stdout: '',
                    });
                }),
            );
            const parentLocator = new SimpleLocator([]);
            const resolver = new PythonEnvsResolver(parentLocator, envInfoService);

            const expected = await resolver.resolveEnv(path.join(testVirtualHomeDir, '.venvs', 'win1', 'python.exe'));

            assert.deepEqual(expected, undefined);
        });
    });
});
