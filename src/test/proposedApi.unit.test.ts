// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as typemoq from 'typemoq';
import { expect } from 'chai';
import { ConfigurationTarget, Uri } from 'vscode';
import { InterpreterDetails, IProposedExtensionAPI } from '../client/apiTypes';
import { IConfigurationService, IInterpreterPathService, IPythonSettings } from '../client/common/types';
import { IComponentAdapter } from '../client/interpreter/contracts';
import { IServiceContainer } from '../client/ioc/types';
import { buildProposedApi } from '../client/proposedApi';
import { IDiscoveryAPI } from '../client/pythonEnvironments/base/locator';
import { EnvironmentType } from '../client/pythonEnvironments/info';
import { PythonEnvKind, PythonEnvSource } from '../client/pythonEnvironments/base/info';
import { Architecture } from '../client/common/utils/platform';

suite('Proposed Extension API', () => {
    let serviceContainer: typemoq.IMock<IServiceContainer>;
    let discoverAPI: typemoq.IMock<IDiscoveryAPI>;
    let interpreterPathService: typemoq.IMock<IInterpreterPathService>;
    let configService: typemoq.IMock<IConfigurationService>;
    let pyenvs: typemoq.IMock<IComponentAdapter>;

    let proposed: IProposedExtensionAPI;

    setup(() => {
        serviceContainer = typemoq.Mock.ofType<IServiceContainer>(undefined, typemoq.MockBehavior.Strict);
        discoverAPI = typemoq.Mock.ofType<IDiscoveryAPI>(undefined, typemoq.MockBehavior.Strict);
        interpreterPathService = typemoq.Mock.ofType<IInterpreterPathService>(undefined, typemoq.MockBehavior.Strict);
        configService = typemoq.Mock.ofType<IConfigurationService>(undefined, typemoq.MockBehavior.Strict);
        pyenvs = typemoq.Mock.ofType<IComponentAdapter>(undefined, typemoq.MockBehavior.Strict);

        serviceContainer.setup((s) => s.get(IInterpreterPathService)).returns(() => interpreterPathService.object);
        serviceContainer.setup((s) => s.get(IConfigurationService)).returns(() => configService.object);
        serviceContainer.setup((s) => s.get(IComponentAdapter)).returns(() => pyenvs.object);

        proposed = buildProposedApi(discoverAPI.object, serviceContainer.object);
    });

    test('getActiveInterpreterPath: No resource', async () => {
        const pythonPath = 'this/is/a/test/path';
        configService
            .setup((c) => c.getSettings(undefined))
            .returns(() => (({ pythonPath } as unknown) as IPythonSettings));
        const actual = await proposed.environment.getActiveInterpreterPath();
        expect(actual).to.be.equals(pythonPath);
    });
    test('getActiveInterpreterPath: With resource', async () => {
        const resource = Uri.file(__filename);
        const pythonPath = 'this/is/a/test/path';
        configService
            .setup((c) => c.getSettings(resource))
            .returns(() => (({ pythonPath } as unknown) as IPythonSettings));
        const actual = await proposed.environment.getActiveInterpreterPath(resource);
        expect(actual).to.be.equals(pythonPath);
    });

    test('getInterpreterDetails: no discovered python', async () => {
        discoverAPI.setup((d) => d.getEnvs()).returns(() => []);
        pyenvs.setup((p) => p.getInterpreterDetails(typemoq.It.isAny())).returns(() => Promise.resolve(undefined));

        const pythonPath = 'this/is/a/test/path (without cache)';
        const actual = await proposed.environment.getInterpreterDetails(pythonPath);
        expect(actual).to.be.equal(undefined);
    });

    test('getInterpreterDetails: no discovered python (with cache)', async () => {
        discoverAPI.setup((d) => d.getEnvs()).returns(() => []);
        pyenvs.setup((p) => p.getInterpreterDetails(typemoq.It.isAny())).returns(() => Promise.resolve(undefined));

        const pythonPath = 'this/is/a/test/path';
        const actual = await proposed.environment.getInterpreterDetails(pythonPath, { useCache: true });
        expect(actual).to.be.equal(undefined);
    });

    test('getInterpreterDetails: without cache', async () => {
        const pythonPath = 'this/is/a/test/path';

        const expected: InterpreterDetails = {
            path: pythonPath,
            version: ['3', '9', '0'],
            environmentType: [`${EnvironmentType.System}`],
            metadata: {
                sysPrefix: 'prefix/path',
                bitness: Architecture.x64,
            },
        };

        discoverAPI.setup((d) => d.getEnvs()).returns(() => []);
        pyenvs
            .setup((p) => p.getInterpreterDetails(pythonPath))
            .returns(() =>
                Promise.resolve({
                    path: pythonPath,
                    version: {
                        raw: '3.9.0',
                        major: 3,
                        minor: 9,
                        patch: 0,
                        build: [],
                        prerelease: [],
                    },
                    envType: EnvironmentType.System,
                    architecture: Architecture.x64,
                    sysPrefix: 'prefix/path',
                }),
            );

        const actual = await proposed.environment.getInterpreterDetails(pythonPath, { useCache: false });
        expect(actual).to.be.deep.equal(expected);
    });

    test('getInterpreterDetails: from cache', async () => {
        const pythonPath = 'this/is/a/test/path';

        const expected: InterpreterDetails = {
            path: pythonPath,
            version: ['3', '9', '0'],
            environmentType: [`${PythonEnvKind.System}`],
            metadata: {
                sysPrefix: 'prefix/path',
                bitness: Architecture.x64,
            },
        };

        discoverAPI
            .setup((d) => d.getEnvs())
            .returns(() => [
                {
                    executable: {
                        filename: pythonPath,
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
            ]);
        pyenvs
            .setup((p) => p.getInterpreterDetails(pythonPath))
            .returns(() =>
                Promise.resolve({
                    path: pythonPath,
                    version: {
                        raw: '3.9.0',
                        major: 3,
                        minor: 9,
                        patch: 0,
                        build: [],
                        prerelease: [],
                    },
                    envType: EnvironmentType.System,
                    architecture: Architecture.x64,
                    sysPrefix: 'prefix/path',
                }),
            );

        const actual = await proposed.environment.getInterpreterDetails(pythonPath, { useCache: true });
        expect(actual).to.be.deep.equal(expected);
    });

    test('getInterpreterDetails: cache miss', async () => {
        const pythonPath = 'this/is/a/test/path';

        const expected: InterpreterDetails = {
            path: pythonPath,
            version: ['3', '9', '0'],
            environmentType: [`${EnvironmentType.System}`],
            metadata: {
                sysPrefix: 'prefix/path',
                bitness: Architecture.x64,
            },
        };

        // Force this API to return empty to cause a cache miss.
        discoverAPI.setup((d) => d.getEnvs()).returns(() => []);
        pyenvs
            .setup((p) => p.getInterpreterDetails(pythonPath))
            .returns(() =>
                Promise.resolve({
                    path: pythonPath,
                    version: {
                        raw: '3.9.0',
                        major: 3,
                        minor: 9,
                        patch: 0,
                        build: [],
                        prerelease: [],
                    },
                    envType: EnvironmentType.System,
                    architecture: Architecture.x64,
                    sysPrefix: 'prefix/path',
                }),
            );

        const actual = await proposed.environment.getInterpreterDetails(pythonPath, { useCache: true });
        expect(actual).to.be.deep.equal(expected);
    });

    test('getInterpreterPaths: no pythons found', async () => {
        discoverAPI.setup((d) => d.getEnvs()).returns(() => []);
        const actual = await proposed.environment.getInterpreterPaths();
        expect(actual).to.be.deep.equal([]);
    });

    test('getInterpreterPaths: python found', async () => {
        discoverAPI
            .setup((d) => d.getEnvs())
            .returns(() => [
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
            ]);
        const actual = await proposed.environment.getInterpreterPaths();
        expect(actual).to.be.deep.equal(['this/is/a/test/python/path1', 'this/is/a/test/python/path2']);
    });

    test('setActiveInterpreter: no resource', async () => {
        interpreterPathService
            .setup((i) => i.update(undefined, ConfigurationTarget.Workspace, 'this/is/a/test/python/path'))
            .returns(() => Promise.resolve())
            .verifiable(typemoq.Times.once());

        await proposed.environment.setActiveInterpreter('this/is/a/test/python/path');

        interpreterPathService.verifyAll();
    });
    test('setActiveInterpreter: with resource', async () => {
        const resource = Uri.parse('a');
        interpreterPathService
            .setup((i) => i.update(resource, ConfigurationTarget.Workspace, 'this/is/a/test/python/path'))
            .returns(() => Promise.resolve())
            .verifiable(typemoq.Times.once());

        await proposed.environment.setActiveInterpreter('this/is/a/test/python/path', resource);

        interpreterPathService.verifyAll();
    });

    test('refreshInterpreters: common scenario', async () => {
        discoverAPI
            .setup((d) => d.triggerRefresh(undefined))
            .returns(() => Promise.resolve())
            .verifiable(typemoq.Times.once());
        discoverAPI
            .setup((d) => d.getEnvs())
            .returns(() => [
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
            ]);

        const actual = await proposed.environment.refreshInterpreters();
        expect(actual).to.be.deep.equal(['this/is/a/test/python/path1', 'this/is/a/test/python/path2']);
        discoverAPI.verifyAll();
    });

    test('getRefreshPromise: common scenario', () => {
        const expected = Promise.resolve();
        discoverAPI.setup((d) => d.refreshPromise).returns(() => expected);
        const actual = proposed.environment.getRefreshPromise();

        // We are comparing instances here, they should be the same instance.
        // So '==' is ok here.
        // eslint-disable-next-line eqeqeq
        expect(actual == expected).is.equal(true);
    });
});
