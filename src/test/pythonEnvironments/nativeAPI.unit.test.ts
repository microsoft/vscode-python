// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
/* eslint-disable class-methods-use-this */

import { assert } from 'chai';
import * as path from 'path';
import * as typemoq from 'typemoq';
import * as sinon from 'sinon';
import * as nativeAPI from '../../client/pythonEnvironments/nativeAPI';
import { IDiscoveryAPI } from '../../client/pythonEnvironments/base/locator';
import {
    NativeEnvInfo,
    NativePythonFinder,
} from '../../client/pythonEnvironments/base/locators/common/nativePythonFinder';
import { Architecture } from '../../client/common/utils/platform';
import { PythonEnvInfo, PythonEnvKind, PythonEnvType } from '../../client/pythonEnvironments/base/info';
import { isWindows } from '../../client/common/platform/platformService';

suite('Native Python API', () => {
    let api: IDiscoveryAPI;
    let mockFinder: typemoq.IMock<NativePythonFinder>;

    const basicEnv: NativeEnvInfo = {
        displayName: 'Basic Python',
        name: 'basic_python',
        executable: '/usr/bin/python',
        kind: 'system',
        version: `3.12.0`,
        prefix: '/usr/bin',
    };

    const basicEnv2: NativeEnvInfo = {
        displayName: 'Basic Python',
        name: 'basic_python',
        executable: '/usr/bin/python',
        kind: 'system',
        version: undefined, // this is intentionally set to trigger resolve
        prefix: '/usr/bin',
    };

    const expectedBasicEnv: PythonEnvInfo = {
        arch: Architecture.Unknown,
        detailedDisplayName: "Python 3.12.0 ('basic_python')",
        display: "Python 3.12.0 ('basic_python')",
        distro: { org: '' },
        executable: { filename: '/usr/bin/python', sysPrefix: '/usr/bin', ctime: -1, mtime: -1 },
        kind: PythonEnvKind.System,
        location: '/usr/bin',
        source: [],
        name: 'basic_python',
        type: undefined,
        version: { sysVersion: '3.12.0', major: 3, minor: 12, micro: 0 },
    };

    const conda: NativeEnvInfo = {
        displayName: 'Conda Python',
        name: 'conda_python',
        executable: '/home/user/.conda/envs/conda_python/python',
        kind: 'conda',
        version: `3.12.0`,
        prefix: '/home/user/.conda/envs/conda_python',
    };

    const conda1: NativeEnvInfo = {
        displayName: 'Conda Python',
        name: 'conda_python',
        executable: '/home/user/.conda/envs/conda_python/python',
        kind: 'conda',
        version: undefined, // this is intentionally set to test conda without python
        prefix: '/home/user/.conda/envs/conda_python',
    };

    const conda2: NativeEnvInfo = {
        displayName: 'Conda Python',
        name: 'conda_python',
        executable: undefined, // this is intentionally set to test env with no executable
        kind: 'conda',
        version: undefined, // this is intentionally set to test conda without python
        prefix: '/home/user/.conda/envs/conda_python',
    };

    const exePath = isWindows()
        ? path.join('/home/user/.conda/envs/conda_python', 'python.exe')
        : path.join('/home/user/.conda/envs/conda_python', 'python');

    const expectedConda1: PythonEnvInfo = {
        arch: Architecture.Unknown,
        detailedDisplayName: "Python 3.12.0 ('conda_python')",
        display: "Python 3.12.0 ('conda_python')",
        distro: { org: '' },
        executable: {
            filename: '/home/user/.conda/envs/conda_python/python',
            sysPrefix: '/home/user/.conda/envs/conda_python',
            ctime: -1,
            mtime: -1,
        },
        kind: PythonEnvKind.Conda,
        location: '/home/user/.conda/envs/conda_python',
        source: [],
        name: 'conda_python',
        type: PythonEnvType.Conda,
        version: { sysVersion: '3.12.0', major: 3, minor: 12, micro: 0 },
    };

    const expectedConda2: PythonEnvInfo = {
        arch: Architecture.Unknown,
        detailedDisplayName: 'Conda Python',
        display: 'Conda Python',
        distro: { org: '' },
        executable: {
            filename: exePath,
            sysPrefix: '/home/user/.conda/envs/conda_python',
            ctime: -1,
            mtime: -1,
        },
        kind: PythonEnvKind.Conda,
        location: '/home/user/.conda/envs/conda_python',
        source: [],
        name: 'conda_python',
        type: PythonEnvType.Conda,
        version: { sysVersion: undefined, major: -1, minor: -1, micro: -1 },
    };

    setup(() => {
        mockFinder = typemoq.Mock.ofType<NativePythonFinder>();

        mockFinder
            .setup((f) => f.categoryToKind(typemoq.It.isAny()))
            .returns((category: string) => {
                switch (category.toLowerCase()) {
                    case 'conda':
                        return PythonEnvKind.Conda;
                    case 'system':
                    case 'homebrew':
                    case 'macpythonorg':
                    case 'maccommandlinetools':
                    case 'macxcode':
                    case 'windowsregistry':
                    case 'linuxglobal':
                        return PythonEnvKind.System;
                    case 'globalpaths':
                        return PythonEnvKind.OtherGlobal;
                    case 'pyenv':
                        return PythonEnvKind.Pyenv;
                    case 'poetry':
                        return PythonEnvKind.Poetry;
                    case 'pipenv':
                        return PythonEnvKind.Pipenv;
                    case 'pyenvvirtualenv':
                        return PythonEnvKind.VirtualEnv;
                    case 'venv':
                        return PythonEnvKind.Venv;
                    case 'virtualenv':
                        return PythonEnvKind.VirtualEnv;
                    case 'virtualenvwrapper':
                        return PythonEnvKind.VirtualEnvWrapper;
                    case 'windowsstore':
                        return PythonEnvKind.MicrosoftStore;
                    default: {
                        return PythonEnvKind.Unknown;
                    }
                }
            });

        api = nativeAPI.createNativeEnvironmentsApi(mockFinder.object);
    });

    teardown(() => {
        sinon.restore();
    });

    test('Trigger refresh without resolve', async () => {
        mockFinder
            .setup((f) => f.refresh())
            .returns(() => {
                async function* generator() {
                    yield* [basicEnv];
                }
                return generator();
            })
            .verifiable(typemoq.Times.once());

        mockFinder.setup((f) => f.resolve(typemoq.It.isAny())).verifiable(typemoq.Times.never());

        await api.triggerRefresh();
        const actual = api.getEnvs();
        assert.deepEqual(actual, [expectedBasicEnv]);
    });

    test('Trigger refresh with resolve', async () => {
        mockFinder
            .setup((f) => f.refresh())
            .returns(() => {
                async function* generator() {
                    yield* [basicEnv2];
                }
                return generator();
            })
            .verifiable(typemoq.Times.once());

        mockFinder
            .setup((f) => f.resolve(typemoq.It.isAny()))
            .returns(() => Promise.resolve(basicEnv))
            .verifiable(typemoq.Times.once());

        api.triggerRefresh();
        await api.getRefreshPromise();

        const actual = api.getEnvs();
        assert.deepEqual(actual, [expectedBasicEnv]);
    });

    test('Trigger refresh and use refresh promise API', async () => {
        mockFinder
            .setup((f) => f.refresh())
            .returns(() => {
                async function* generator() {
                    yield* [basicEnv];
                }
                return generator();
            })
            .verifiable(typemoq.Times.once());

        mockFinder.setup((f) => f.resolve(typemoq.It.isAny())).verifiable(typemoq.Times.never());

        api.triggerRefresh();
        await api.getRefreshPromise();

        const actual = api.getEnvs();
        assert.deepEqual(actual, [expectedBasicEnv]);
    });

    test('Conda environment with resolve', async () => {
        mockFinder
            .setup((f) => f.refresh())
            .returns(() => {
                async function* generator() {
                    yield* [conda1];
                }
                return generator();
            })
            .verifiable(typemoq.Times.once());
        mockFinder
            .setup((f) => f.resolve(typemoq.It.isAny()))
            .returns(() => Promise.resolve(conda))
            .verifiable(typemoq.Times.once());

        await api.triggerRefresh();
        const actual = api.getEnvs();
        assert.deepEqual(actual, [expectedConda1]);
    });

    test('Conda environment with no python', async () => {
        mockFinder
            .setup((f) => f.refresh())
            .returns(() => {
                async function* generator() {
                    yield* [conda2];
                }
                return generator();
            })
            .verifiable(typemoq.Times.once());
        mockFinder.setup((f) => f.resolve(typemoq.It.isAny())).verifiable(typemoq.Times.never());

        await api.triggerRefresh();
        const actual = api.getEnvs();
        assert.deepEqual(actual, [expectedConda2]);
    });

    test('Refresh promise undefined after refresh', async () => {
        mockFinder
            .setup((f) => f.refresh())
            .returns(() => {
                async function* generator() {
                    yield* [basicEnv];
                }
                return generator();
            })
            .verifiable(typemoq.Times.once());

        mockFinder.setup((f) => f.resolve(typemoq.It.isAny())).verifiable(typemoq.Times.never());

        await api.triggerRefresh();
        assert.isUndefined(api.getRefreshPromise());
    });
});
