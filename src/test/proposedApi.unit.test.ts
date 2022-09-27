// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as typemoq from 'typemoq';
import { assert, expect } from 'chai';
import { Uri, EventEmitter, ConfigurationTarget, WorkspaceFolder } from 'vscode';
import { cloneDeep } from 'lodash';
import {
    IConfigurationService,
    IDisposableRegistry,
    IExtensions,
    IInterpreterPathService,
    IPythonSettings,
} from '../client/common/types';
import { IServiceContainer } from '../client/ioc/types';
import {
    buildProposedApi,
    convertCompleteEnvInfo,
    convertEnvInfo,
    EnvironmentReference,
    reportActiveInterpreterChanged,
} from '../client/proposedApi';
import { IDiscoveryAPI, ProgressNotificationEvent } from '../client/pythonEnvironments/base/locator';
import { buildEnvInfo } from '../client/pythonEnvironments/base/info/env';
import { sleep } from './core';
import { PythonEnvKind, PythonEnvSource } from '../client/pythonEnvironments/base/info';
import { Architecture } from '../client/common/utils/platform';
import { PythonEnvCollectionChangedEvent } from '../client/pythonEnvironments/base/watcher';
import { normCasePath } from '../client/common/platform/fs-paths';
import {
    ActiveEnvironmentPathChangeEvent,
    EnvironmentPath,
    EnvironmentsChangeEvent,
    ProposedExtensionAPI,
} from '../client/proposedApiTypes';

suite('Proposed Extension API', () => {
    let serviceContainer: typemoq.IMock<IServiceContainer>;
    let discoverAPI: typemoq.IMock<IDiscoveryAPI>;
    let interpreterPathService: typemoq.IMock<IInterpreterPathService>;
    let configService: typemoq.IMock<IConfigurationService>;
    let extensions: typemoq.IMock<IExtensions>;
    let onDidChangeRefreshState: EventEmitter<ProgressNotificationEvent>;
    let onDidChangeEnvironments: EventEmitter<PythonEnvCollectionChangedEvent>;

    let proposed: ProposedExtensionAPI;

    setup(() => {
        serviceContainer = typemoq.Mock.ofType<IServiceContainer>();
        discoverAPI = typemoq.Mock.ofType<IDiscoveryAPI>();
        extensions = typemoq.Mock.ofType<IExtensions>();
        extensions
            .setup((e) => e.determineExtensionFromCallStack())
            .returns(() => Promise.resolve({ extensionId: 'id', displayName: 'displayName', apiName: 'apiName' }))
            .verifiable(typemoq.Times.atLeastOnce());
        interpreterPathService = typemoq.Mock.ofType<IInterpreterPathService>();
        configService = typemoq.Mock.ofType<IConfigurationService>();
        onDidChangeRefreshState = new EventEmitter();
        onDidChangeEnvironments = new EventEmitter();

        serviceContainer.setup((s) => s.get(IExtensions)).returns(() => extensions.object);
        serviceContainer.setup((s) => s.get(IInterpreterPathService)).returns(() => interpreterPathService.object);
        serviceContainer.setup((s) => s.get(IConfigurationService)).returns(() => configService.object);
        serviceContainer.setup((s) => s.get(IDisposableRegistry)).returns(() => []);

        discoverAPI.setup((d) => d.onProgress).returns(() => onDidChangeRefreshState.event);
        discoverAPI.setup((d) => d.onChanged).returns(() => onDidChangeEnvironments.event);

        proposed = buildProposedApi(discoverAPI.object, serviceContainer.object);
    });

    teardown(() => {
        // Verify each API method sends telemetry regarding who called the API.
        extensions.verifyAll();
    });

    test('Provide an event to track when active environment details change', async () => {
        const events: ActiveEnvironmentPathChangeEvent[] = [];
        proposed.environment.onDidChangeActiveEnvironmentPath((e) => {
            events.push(e);
        });
        reportActiveInterpreterChanged({ path: 'path/to/environment', resource: undefined });
        await sleep(1);
        assert.deepEqual(events, [
            { id: normCasePath('path/to/environment'), path: 'path/to/environment', resource: undefined },
        ]);
    });

    test('getActiveEnvironmentPath: No resource', () => {
        const pythonPath = 'this/is/a/test/path';
        configService
            .setup((c) => c.getSettings(undefined))
            .returns(() => (({ pythonPath } as unknown) as IPythonSettings));
        const actual = proposed.environment.getActiveEnvironmentPath();
        assert.deepEqual(actual, ({
            id: normCasePath(pythonPath),
            path: pythonPath,
            pathType: 'interpreterPath',
        } as unknown) as EnvironmentPath);
    });

    test('getActiveEnvironmentPath: default python', () => {
        const pythonPath = 'python';
        configService
            .setup((c) => c.getSettings(undefined))
            .returns(() => (({ pythonPath } as unknown) as IPythonSettings));
        const actual = proposed.environment.getActiveEnvironmentPath();
        assert.deepEqual(actual, ({
            id: 'DEFAULT_PYTHON',
            path: pythonPath,
            pathType: 'interpreterPath',
        } as unknown) as EnvironmentPath);
    });

    test('getActiveEnvironmentPath: With resource', () => {
        const pythonPath = 'this/is/a/test/path';
        const resource = Uri.file(__filename);
        configService
            .setup((c) => c.getSettings(resource))
            .returns(() => (({ pythonPath } as unknown) as IPythonSettings));
        const actual = proposed.environment.getActiveEnvironmentPath(resource);
        assert.deepEqual(actual, ({
            id: normCasePath(pythonPath),
            path: pythonPath,
            pathType: 'interpreterPath',
        } as unknown) as EnvironmentPath);
    });

    test('resolveEnvironment: invalid environment (when passed as string)', async () => {
        const pythonPath = 'this/is/a/test/path';
        discoverAPI.setup((p) => p.resolveEnv(pythonPath)).returns(() => Promise.resolve(undefined));

        const actual = await proposed.environment.resolveEnvironment(pythonPath);
        expect(actual).to.be.equal(undefined);
    });

    test('resolveEnvironment: valid environment (when passed as string)', async () => {
        const pythonPath = 'this/is/a/test/path';
        const env = buildEnvInfo({
            executable: pythonPath,
            version: {
                major: 3,
                minor: 9,
                micro: 0,
            },
            kind: PythonEnvKind.System,
            arch: Architecture.x64,
            sysPrefix: 'prefix/path',
            searchLocation: Uri.file('path/to/project'),
        });
        discoverAPI.setup((p) => p.resolveEnv(pythonPath)).returns(() => Promise.resolve(env));

        const actual = await proposed.environment.resolveEnvironment(pythonPath);
        assert.deepEqual((actual as EnvironmentReference).internal, convertCompleteEnvInfo(env));
    });

    test('resolveEnvironment: valid environment (when passed as environment)', async () => {
        const pythonPath = 'this/is/a/test/path';
        const env = buildEnvInfo({
            executable: pythonPath,
            version: {
                major: 3,
                minor: 9,
                micro: 0,
            },
            kind: PythonEnvKind.System,
            arch: Architecture.x64,
            sysPrefix: 'prefix/path',
            searchLocation: Uri.file('path/to/project'),
        });
        const partialEnv = buildEnvInfo({
            executable: pythonPath,
            kind: PythonEnvKind.System,
            sysPrefix: 'prefix/path',
            searchLocation: Uri.file('path/to/project'),
        });
        discoverAPI.setup((p) => p.resolveEnv(pythonPath)).returns(() => Promise.resolve(env));

        const actual = await proposed.environment.resolveEnvironment(convertCompleteEnvInfo(partialEnv));
        assert.deepEqual((actual as EnvironmentReference).internal, convertCompleteEnvInfo(env));
    });

    test('environments: no pythons found', () => {
        discoverAPI.setup((d) => d.getEnvs()).returns(() => []);
        const actual = proposed.environment.all;
        expect(actual).to.be.deep.equal([]);
    });

    test('environments: python found', async () => {
        const envs = [
            {
                executable: {
                    filename: 'this/is/a/test/python/path1',
                    ctime: 1,
                    mtime: 2,
                    sysPrefix: 'prefix/path',
                },
                version: {
                    major: 3,
                    minor: 9,
                    micro: 0,
                },
                kind: PythonEnvKind.System,
                arch: Architecture.x64,
                name: '',
                location: '',
                source: [PythonEnvSource.PathEnvVar],
                distro: {
                    org: '',
                },
            },
            {
                executable: {
                    filename: 'this/is/a/test/python/path2',
                    ctime: 1,
                    mtime: 2,
                    sysPrefix: 'prefix/path',
                },
                version: {
                    major: 3,
                    minor: -1,
                    micro: -1,
                },
                kind: PythonEnvKind.Venv,
                arch: Architecture.x64,
                name: '',
                location: '',
                source: [PythonEnvSource.PathEnvVar],
                distro: {
                    org: '',
                },
            },
        ];
        discoverAPI.setup((d) => d.getEnvs()).returns(() => envs);
        const actual = proposed.environment.all;
        const actualEnvs = actual?.map((a) => (a as EnvironmentReference).internal);
        assert.deepEqual(
            actualEnvs?.sort((a, b) => a.id.localeCompare(b.id)),
            envs.map((e) => convertEnvInfo(e)).sort((a, b) => a.id.localeCompare(b.id)),
        );
    });

    test('Provide an event to track when list of environments change', async () => {
        let events: EnvironmentsChangeEvent[] = [];
        let eventValues: EnvironmentsChangeEvent[] = [];
        let expectedEvents: EnvironmentsChangeEvent[] = [];
        proposed.environment.onDidChangeEnvironments((e) => {
            events.push(e);
        });
        const envs = [
            buildEnvInfo({
                executable: 'pythonPath',
                kind: PythonEnvKind.System,
                sysPrefix: 'prefix/path',
                searchLocation: Uri.file('path/to/project'),
            }),
            {
                executable: {
                    filename: 'this/is/a/test/python/path1',
                    ctime: 1,
                    mtime: 2,
                    sysPrefix: 'prefix/path',
                },
                version: {
                    major: 3,
                    minor: 9,
                    micro: 0,
                },
                kind: PythonEnvKind.System,
                arch: Architecture.x64,
                name: '',
                location: '',
                source: [PythonEnvSource.PathEnvVar],
                distro: {
                    org: '',
                },
            },
            {
                executable: {
                    filename: 'this/is/a/test/python/path2',
                    ctime: 1,
                    mtime: 2,
                    sysPrefix: 'prefix/path',
                },
                version: {
                    major: 3,
                    minor: 10,
                    micro: 0,
                },
                kind: PythonEnvKind.Venv,
                arch: Architecture.x64,
                name: '',
                location: '',
                source: [PythonEnvSource.PathEnvVar],
                distro: {
                    org: '',
                },
            },
        ];

        // Now fire and verify events. Note the event value holds the reference to an environment, so may itself
        // change when the environment is altered. So it's important to verify them as soon as they're received.

        // Add events
        onDidChangeEnvironments.fire({ old: undefined, new: envs[0] });
        expectedEvents.push({ env: convertEnvInfo(envs[0]), type: 'add' });
        onDidChangeEnvironments.fire({ old: undefined, new: envs[1] });
        expectedEvents.push({ env: convertEnvInfo(envs[1]), type: 'add' });
        onDidChangeEnvironments.fire({ old: undefined, new: envs[2] });
        expectedEvents.push({ env: convertEnvInfo(envs[2]), type: 'add' });
        eventValues = events.map((e) => ({ env: (e.env as EnvironmentReference).internal, type: e.type }));
        assert.deepEqual(eventValues, expectedEvents);

        // Update events
        events = [];
        expectedEvents = [];
        const updatedEnv = cloneDeep(envs[0]);
        updatedEnv.arch = Architecture.x86;
        onDidChangeEnvironments.fire({ old: envs[0], new: updatedEnv });
        expectedEvents.push({ env: convertEnvInfo(updatedEnv), type: 'update' });
        eventValues = events.map((e) => ({ env: (e.env as EnvironmentReference).internal, type: e.type }));
        assert.deepEqual(eventValues, expectedEvents);

        // Remove events
        events = [];
        expectedEvents = [];
        onDidChangeEnvironments.fire({ old: envs[2], new: undefined });
        expectedEvents.push({ env: convertEnvInfo(envs[2]), type: 'remove' });
        eventValues = events.map((e) => ({ env: (e.env as EnvironmentReference).internal, type: e.type }));
        assert.deepEqual(eventValues, expectedEvents);
    });

    test('updateActiveEnvironmentPath: no resource', async () => {
        interpreterPathService
            .setup((i) => i.update(undefined, ConfigurationTarget.WorkspaceFolder, 'this/is/a/test/python/path'))
            .returns(() => Promise.resolve())
            .verifiable(typemoq.Times.once());

        await proposed.environment.updateActiveEnvironmentPath('this/is/a/test/python/path');

        interpreterPathService.verifyAll();
    });

    test('updateActiveEnvironmentPath: passed as Environment', async () => {
        interpreterPathService
            .setup((i) => i.update(undefined, ConfigurationTarget.WorkspaceFolder, 'this/is/a/test/python/path'))
            .returns(() => Promise.resolve())
            .verifiable(typemoq.Times.once());

        await proposed.environment.updateActiveEnvironmentPath({
            id: normCasePath('this/is/a/test/python/path'),
            path: 'this/is/a/test/python/path',
        });

        interpreterPathService.verifyAll();
    });

    test('updateActiveEnvironmentPath: with uri', async () => {
        const uri = Uri.parse('a');
        interpreterPathService
            .setup((i) => i.update(uri, ConfigurationTarget.WorkspaceFolder, 'this/is/a/test/python/path'))
            .returns(() => Promise.resolve())
            .verifiable(typemoq.Times.once());

        await proposed.environment.updateActiveEnvironmentPath('this/is/a/test/python/path', uri);

        interpreterPathService.verifyAll();
    });

    test('updateActiveEnvironmentPath: with workspace folder', async () => {
        const uri = Uri.parse('a');
        interpreterPathService
            .setup((i) => i.update(uri, ConfigurationTarget.WorkspaceFolder, 'this/is/a/test/python/path'))
            .returns(() => Promise.resolve())
            .verifiable(typemoq.Times.once());
        const workspace: WorkspaceFolder = {
            uri,
            name: '',
            index: 0,
        };

        await proposed.environment.updateActiveEnvironmentPath('this/is/a/test/python/path', workspace);

        interpreterPathService.verifyAll();
    });

    test('refreshInterpreters: default', async () => {
        discoverAPI
            .setup((d) => d.triggerRefresh(undefined, typemoq.It.isValue({ ifNotTriggerredAlready: true })))
            .returns(() => Promise.resolve())
            .verifiable(typemoq.Times.once());

        await proposed.environment.refreshEnvironments();

        discoverAPI.verifyAll();
    });

    test('refreshInterpreters: when forcing a refresh', async () => {
        discoverAPI
            .setup((d) => d.triggerRefresh(undefined, typemoq.It.isValue({ ifNotTriggerredAlready: false })))
            .returns(() => Promise.resolve())
            .verifiable(typemoq.Times.once());

        await proposed.environment.refreshEnvironments({ forceRefresh: true });

        discoverAPI.verifyAll();
    });
});
