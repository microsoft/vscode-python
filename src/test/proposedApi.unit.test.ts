// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as typemoq from 'typemoq';
import { assert } from 'chai';
import { Uri, Event, EventEmitter } from 'vscode';
import { IDisposableRegistry, IInterpreterPathService } from '../client/common/types';
import { IInterpreterService } from '../client/interpreter/contracts';
import { IServiceContainer } from '../client/ioc/types';
import {
    buildProposedApi,
    convertCompleteEnvInfo,
    EnvironmentReference,
    reportActiveInterpreterChanged,
} from '../client/proposedApi';
import {
    IDiscoveryAPI,
    ProgressNotificationEvent,
    ProgressReportStage,
} from '../client/pythonEnvironments/base/locator';
import { PythonEnvironment } from '../client/pythonEnvironments/info';
import { buildEnvInfo } from '../client/pythonEnvironments/base/info/env';
import {
    ActiveEnvironmentChangedParams,
    IProposedExtensionAPI,
    RefreshState,
    RefreshStateValue,
} from '../client/proposedApiTypes';
import { sleep } from './core';

suite('Proposed Extension API', () => {
    let serviceContainer: typemoq.IMock<IServiceContainer>;
    let discoverAPI: typemoq.IMock<IDiscoveryAPI>;
    let interpreterPathService: typemoq.IMock<IInterpreterPathService>;
    let interpreterService: typemoq.IMock<IInterpreterService>;
    let onDidExecutionEvent: Event<Uri | undefined>;
    let onDidChangeRefreshState: EventEmitter<ProgressNotificationEvent>;

    let proposed: IProposedExtensionAPI;

    setup(() => {
        serviceContainer = typemoq.Mock.ofType<IServiceContainer>();
        discoverAPI = typemoq.Mock.ofType<IDiscoveryAPI>();
        interpreterPathService = typemoq.Mock.ofType<IInterpreterPathService>();
        interpreterService = typemoq.Mock.ofType<IInterpreterService>();
        onDidExecutionEvent = typemoq.Mock.ofType<Event<Uri | undefined>>().object;
        onDidChangeRefreshState = new EventEmitter();
        interpreterService.setup((i) => i.onDidChangeInterpreterConfiguration).returns(() => onDidExecutionEvent);

        serviceContainer.setup((s) => s.get(IInterpreterPathService)).returns(() => interpreterPathService.object);
        serviceContainer.setup((s) => s.get(IInterpreterService)).returns(() => interpreterService.object);
        serviceContainer.setup((s) => s.get(IDisposableRegistry)).returns(() => []);

        discoverAPI.setup((d) => d.onProgress).returns(() => onDidChangeRefreshState.event);

        proposed = buildProposedApi(discoverAPI.object, serviceContainer.object);
    });

    test('Provides a event for tracking refresh progress', async () => {
        const events: RefreshState[] = [];
        proposed.environment.locator.onDidChangeRefreshState((e) => {
            events.push(e);
        });
        onDidChangeRefreshState.fire({ stage: ProgressReportStage.discoveryStarted });
        onDidChangeRefreshState.fire({ stage: ProgressReportStage.allPathsDiscovered });
        onDidChangeRefreshState.fire({ stage: ProgressReportStage.discoveryFinished });
        await sleep(1);

        assert.deepEqual(events, [{ state: RefreshStateValue.started }, { state: RefreshStateValue.finished }]);
    });

    test('Provide an event to track when active environment details change', async () => {
        const events: ActiveEnvironmentChangedParams[] = [];
        proposed.environment.activeEnvironment.onDidChange((e) => {
            events.push(e);
        });
        reportActiveInterpreterChanged({ pathID: 'path/to/environment', resource: undefined });
        await sleep(1);
        assert.deepEqual(events, [{ pathID: 'path/to/environment', resource: undefined }]);
    });

    test('getActiveInterpreterPath: No resource', async () => {
        const pythonPath = 'this/is/a/test/path';
        interpreterService
            .setup((c) => c.getActiveInterpreter(undefined))
            .returns(() => Promise.resolve(({ path: pythonPath } as unknown) as PythonEnvironment));
        const env = buildEnvInfo({ executable: pythonPath });
        discoverAPI.setup((d) => d.resolveEnv(pythonPath)).returns(() => Promise.resolve(env));
        const actual = await proposed.environment.activeEnvironment.fetch();
        assert.deepEqual((actual as EnvironmentReference).internal, convertCompleteEnvInfo(env));
    });

    // test('getActiveInterpreterPath: With resource', async () => {
    //     const resource = Uri.file(__filename);
    //     const pythonPath = 'this/is/a/test/path';
    //     interpreterService
    //         .setup((c) => c.getActiveInterpreter(resource))
    //         .returns(() => Promise.resolve(({ path: pythonPath } as unknown) as PythonEnvironment));
    //     const actual = await proposed.environment.getActiveEnvironmentPath(resource);
    //     assert.deepEqual(actual, { path: pythonPath, pathType: 'interpreterPath' });
    // });

    // test('getInterpreterDetails: no discovered python', async () => {
    //     discoverAPI.setup((d) => d.getEnvs()).returns(() => []);
    //     discoverAPI.setup((p) => p.resolveEnv(typemoq.It.isAny())).returns(() => Promise.resolve(undefined));

    //     const pythonPath = 'this/is/a/test/path (without cache)';
    //     const actual = await proposed.environment.getEnvironmentDetails(pythonPath);
    //     expect(actual).to.be.equal(undefined);
    // });

    // test('getInterpreterDetails: no discovered python (with cache)', async () => {
    //     discoverAPI.setup((d) => d.getEnvs()).returns(() => []);
    //     discoverAPI.setup((p) => p.resolveEnv(typemoq.It.isAny())).returns(() => Promise.resolve(undefined));

    //     const pythonPath = 'this/is/a/test/path';
    //     const actual = await proposed.environment.getEnvironmentDetails(pythonPath, { useCache: true });
    //     expect(actual).to.be.equal(undefined);
    // });

    // test('getInterpreterDetails: without cache', async () => {
    //     const pythonPath = 'this/is/a/test/path';

    //     const expected: EnvironmentDetails = {
    //         interpreterPath: pythonPath,
    //         version: ['3', '9', '0'],
    //         environmentType: [PythonEnvKind.System],
    //         metadata: {
    //             sysPrefix: 'prefix/path',
    //             bitness: Architecture.x64,
    //             project: Uri.file('path/to/project'),
    //         },
    //         envFolderPath: undefined,
    //     };

    //     discoverAPI.setup((d) => d.getEnvs()).returns(() => []);
    //     discoverAPI
    //         .setup((p) => p.resolveEnv(pythonPath))
    //         .returns(() =>
    //             Promise.resolve(
    //                 buildEnvInfo({
    //                     executable: pythonPath,
    //                     version: {
    //                         major: 3,
    //                         minor: 9,
    //                         micro: 0,
    //                     },
    //                     kind: PythonEnvKind.System,
    //                     arch: Architecture.x64,
    //                     sysPrefix: 'prefix/path',
    //                     searchLocation: Uri.file('path/to/project'),
    //                 }),
    //             ),
    //         );

    //     const actual = await proposed.environment.getEnvironmentDetails(pythonPath, { useCache: false });
    //     expect(actual).to.be.deep.equal(expected);
    // });

    // test('getInterpreterDetails: from cache', async () => {
    //     const pythonPath = 'this/is/a/test/path';

    //     const expected: EnvironmentDetails = {
    //         interpreterPath: pythonPath,
    //         version: ['3', '9', '0'],
    //         environmentType: [PythonEnvKind.System],
    //         metadata: {
    //             sysPrefix: 'prefix/path',
    //             bitness: Architecture.x64,
    //             project: undefined,
    //         },
    //         envFolderPath: undefined,
    //     };

    //     discoverAPI
    //         .setup((d) => d.getEnvs())
    //         .returns(() => [
    //             {
    //                 executable: {
    //                     filename: pythonPath,
    //                     ctime: 1,
    //                     mtime: 2,
    //                     sysPrefix: 'prefix/path',
    //                 },
    //                 version: {
    //                     major: 3,
    //                     minor: 9,
    //                     micro: 0,
    //                 },
    //                 kind: PythonEnvKind.System,
    //                 arch: Architecture.x64,
    //                 name: '',
    //                 location: '',
    //                 source: [PythonEnvSource.PathEnvVar],
    //                 distro: {
    //                     org: '',
    //                 },
    //             },
    //         ]);
    //     discoverAPI
    //         .setup((p) => p.resolveEnv(pythonPath))
    //         .returns(() =>
    //             Promise.resolve(
    //                 buildEnvInfo({
    //                     executable: pythonPath,
    //                     version: {
    //                         major: 3,
    //                         minor: 9,
    //                         micro: 0,
    //                     },
    //                     kind: PythonEnvKind.System,
    //                     arch: Architecture.x64,
    //                     sysPrefix: 'prefix/path',
    //                 }),
    //             ),
    //         );

    //     const actual = await proposed.environment.getEnvironmentDetails(pythonPath, { useCache: true });
    //     expect(actual).to.be.deep.equal(expected);
    // });

    // test('getInterpreterDetails: cache miss', async () => {
    //     const pythonPath = 'this/is/a/test/path';

    //     const expected: EnvironmentDetails = {
    //         interpreterPath: pythonPath,
    //         version: ['3', '9', '0'],
    //         environmentType: [PythonEnvKind.System],
    //         metadata: {
    //             sysPrefix: 'prefix/path',
    //             bitness: Architecture.x64,
    //             project: undefined,
    //         },
    //         envFolderPath: undefined,
    //     };

    //     // Force this API to return empty to cause a cache miss.
    //     discoverAPI.setup((d) => d.getEnvs()).returns(() => []);
    //     discoverAPI
    //         .setup((p) => p.resolveEnv(pythonPath))
    //         .returns(() =>
    //             Promise.resolve(
    //                 buildEnvInfo({
    //                     executable: pythonPath,
    //                     version: {
    //                         major: 3,
    //                         minor: 9,
    //                         micro: 0,
    //                     },
    //                     kind: PythonEnvKind.System,
    //                     arch: Architecture.x64,
    //                     sysPrefix: 'prefix/path',
    //                 }),
    //             ),
    //         );

    //     const actual = await proposed.environment.getEnvironmentDetails(pythonPath, { useCache: true });
    //     expect(actual).to.be.deep.equal(expected);
    // });

    // test('getInterpreterPaths: no pythons found', async () => {
    //     discoverAPI.setup((d) => d.getEnvs()).returns(() => []);
    //     const actual = await proposed.environment.getEnvironmentPaths();
    //     expect(actual).to.be.deep.equal([]);
    // });

    // test('getInterpreterPaths: python found', async () => {
    //     discoverAPI
    //         .setup((d) => d.getEnvs())
    //         .returns(() => [
    //             {
    //                 executable: {
    //                     filename: 'this/is/a/test/python/path1',
    //                     ctime: 1,
    //                     mtime: 2,
    //                     sysPrefix: 'prefix/path',
    //                 },
    //                 version: {
    //                     major: 3,
    //                     minor: 9,
    //                     micro: 0,
    //                 },
    //                 kind: PythonEnvKind.System,
    //                 arch: Architecture.x64,
    //                 name: '',
    //                 location: '',
    //                 source: [PythonEnvSource.PathEnvVar],
    //                 distro: {
    //                     org: '',
    //                 },
    //             },
    //             {
    //                 executable: {
    //                     filename: 'this/is/a/test/python/path2',
    //                     ctime: 1,
    //                     mtime: 2,
    //                     sysPrefix: 'prefix/path',
    //                 },
    //                 version: {
    //                     major: 3,
    //                     minor: 10,
    //                     micro: 0,
    //                 },
    //                 kind: PythonEnvKind.Venv,
    //                 arch: Architecture.x64,
    //                 name: '',
    //                 location: '',
    //                 source: [PythonEnvSource.PathEnvVar],
    //                 distro: {
    //                     org: '',
    //                 },
    //             },
    //         ]);
    //     const actual = await proposed.environment.getEnvironmentPaths();
    //     expect(actual?.map((a) => a.path)).to.be.deep.equal([
    //         'this/is/a/test/python/path1',
    //         'this/is/a/test/python/path2',
    //     ]);
    // });

    // test('setActiveInterpreter: no resource', async () => {
    //     interpreterPathService
    //         .setup((i) => i.update(undefined, ConfigurationTarget.WorkspaceFolder, 'this/is/a/test/python/path'))
    //         .returns(() => Promise.resolve())
    //         .verifiable(typemoq.Times.once());

    //     await proposed.environment.setActiveEnvironment('this/is/a/test/python/path');

    //     interpreterPathService.verifyAll();
    // });
    // test('setActiveInterpreter: with resource', async () => {
    //     const resource = Uri.parse('a');
    //     interpreterPathService
    //         .setup((i) => i.update(resource, ConfigurationTarget.WorkspaceFolder, 'this/is/a/test/python/path'))
    //         .returns(() => Promise.resolve())
    //         .verifiable(typemoq.Times.once());

    //     await proposed.environment.setActiveEnvironment('this/is/a/test/python/path', resource);

    //     interpreterPathService.verifyAll();
    // });

    // test('refreshInterpreters: common scenario', async () => {
    //     discoverAPI
    //         .setup((d) => d.triggerRefresh(undefined, undefined))
    //         .returns(() => Promise.resolve())
    //         .verifiable(typemoq.Times.once());
    //     discoverAPI
    //         .setup((d) => d.getEnvs())
    //         .returns(() => [
    //             {
    //                 executable: {
    //                     filename: 'this/is/a/test/python/path1',
    //                     ctime: 1,
    //                     mtime: 2,
    //                     sysPrefix: 'prefix/path',
    //                 },
    //                 version: {
    //                     major: 3,
    //                     minor: 9,
    //                     micro: 0,
    //                 },
    //                 kind: PythonEnvKind.System,
    //                 arch: Architecture.x64,
    //                 name: '',
    //                 location: 'this/is/a/test/python/path1/folder',
    //                 source: [PythonEnvSource.PathEnvVar],
    //                 distro: {
    //                     org: '',
    //                 },
    //             },
    //             {
    //                 executable: {
    //                     filename: 'this/is/a/test/python/path2',
    //                     ctime: 1,
    //                     mtime: 2,
    //                     sysPrefix: 'prefix/path',
    //                 },
    //                 version: {
    //                     major: 3,
    //                     minor: 10,
    //                     micro: 0,
    //                 },
    //                 kind: PythonEnvKind.Venv,
    //                 arch: Architecture.x64,
    //                 name: '',
    //                 location: '',
    //                 source: [PythonEnvSource.PathEnvVar],
    //                 distro: {
    //                     org: '',
    //                 },
    //             },
    //         ]);

    //     const actual = await proposed.environment.refreshEnvironment();
    //     expect(actual).to.be.deep.equal([
    //         { path: 'this/is/a/test/python/path1/folder', pathType: 'envFolderPath' },
    //         { path: 'this/is/a/test/python/path2', pathType: 'interpreterPath' },
    //     ]);
    //     discoverAPI.verifyAll();
    // });

    // test('getRefreshPromise: common scenario', () => {
    //     const expected = Promise.resolve();
    //     discoverAPI
    //         .setup((d) => d.getRefreshPromise(typemoq.It.isValue({ stage: ProgressReportStage.allPathsDiscovered })))
    //         .returns(() => expected);
    //     const actual = proposed.environment.getRefreshPromise({ stage: ProgressReportStage.allPathsDiscovered });

    //     // We are comparing instances here, they should be the same instance.
    //     // So '==' is ok here.
    //     // eslint-disable-next-line eqeqeq
    //     expect(actual == expected).is.equal(true);
    // });
});
