// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert, expect } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import { ImportMock } from 'ts-mock-imports';
import * as TypeMoq from 'typemoq';
import { Uri } from 'vscode';
import { IWorkspaceService } from '../../../client/common/application/types';
import { IFileSystem } from '../../../client/common/platform/types';
import { ExecutionResult } from '../../../client/common/process/types';
import { IDisposableRegistry, IPersistentState, IPersistentStateFactory } from '../../../client/common/types';
import { createDeferred, createDeferredFromPromise, Deferred, sleep } from '../../../client/common/utils/async';
import { Architecture } from '../../../client/common/utils/platform';
import {
    CONDA_ENV_FILE_SERVICE,
    CONDA_ENV_SERVICE,
    CURRENT_PATH_SERVICE,
    GLOBAL_VIRTUAL_ENV_SERVICE,
    KNOWN_PATH_SERVICE,
    PIPENV_SERVICE,
    WINDOWS_REGISTRY_SERVICE,
    WORKSPACE_VIRTUAL_ENV_SERVICE
} from '../../../client/interpreter/contracts';
import { IServiceContainer } from '../../../client/ioc/types';
import * as ExternalDep from '../../../client/pythonEnvironments/common/externalDependencies';
import { EnvironmentsCollectionService } from '../../../client/pythonEnvironments/discovery/environmentCollection';
import {
    completeInfoEnvironmentMapKey,
    partialInfoEnvironmentMapKey
} from '../../../client/pythonEnvironments/discovery/environmentsStorage';
import {
    IEnvironmentLocatorService,
    IEnvironmentsCollectionService
} from '../../../client/pythonEnvironments/discovery/locators/types';
import { EnvironmentType, PartialPythonEnvironment, PythonEnvironment } from '../../../client/pythonEnvironments/info';
import { EnvironmentInfoService } from '../../../client/pythonEnvironments/info/environmentInfoService';

const keys = [
    WINDOWS_REGISTRY_SERVICE,
    CONDA_ENV_SERVICE,
    CONDA_ENV_FILE_SERVICE,
    PIPENV_SERVICE,
    GLOBAL_VIRTUAL_ENV_SERVICE,
    WORKSPACE_VIRTUAL_ENV_SERVICE,
    KNOWN_PATH_SERVICE,
    CURRENT_PATH_SERVICE
];

suite('Environment collection', async () => {
    let stubShellExec: sinon.SinonStub;
    const resource = Uri.parse('a');
    const anotherResource = Uri.parse('some other resource');
    let persistentState: TypeMoq.IMock<IPersistentStateFactory>;
    let fileSystem: TypeMoq.IMock<IFileSystem>;
    let locatorPromises: Deferred<PartialPythonEnvironment[]>[];
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let partialInfoMapValue: Map<string, PartialPythonEnvironment>;
    let locators: TypeMoq.IMock<IEnvironmentLocatorService>[];
    let environmentsCollection: IEnvironmentsCollectionService;

    function createExpectedEnvInfo(interpreterPath: string): PythonEnvironment {
        return {
            path: interpreterPath,
            architecture: Architecture.x64,
            sysVersion: undefined,
            sysPrefix: 'path',
            pipEnvWorkspaceFolder: undefined,
            version: {
                build: [],
                major: 3,
                minor: 8,
                patch: 3,
                prerelease: ['final'],
                raw: '3.8.3-final'
            },
            companyDisplayName: '',
            displayName: '',
            envType: EnvironmentType.Unknown,
            envName: '',
            envPath: '',
            cachedEntry: false
        };
    }
    setup(() => {
        locatorPromises = [];
        locators = [];
        stubShellExec = ImportMock.mockFunction(
            ExternalDep,
            'shellExecute',
            new Promise<ExecutionResult<string>>((resolve) => {
                resolve({
                    stdout:
                        '{"versionInfo": [3, 8, 3, "final", 0], "sysPrefix": "path", "version": "3.8.3 (tags/v3.8.3:6f8c832, May 13 2020, 22:37:02) [MSC v.1924 64 bit (AMD64)]", "is64Bit": true}'
                });
            })
        );
        fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        const workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        workspaceService
            .setup((w) => w.getWorkspaceFolder(resource))
            .returns(() => ({
                name: '',
                index: 0,
                uri: resource
            }));
        workspaceService
            .setup((w) => w.getWorkspaceFolder(anotherResource))
            .returns(() => ({
                name: '',
                index: 0,
                uri: anotherResource
            }));
        persistentState = TypeMoq.Mock.ofType<IPersistentStateFactory>();
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        serviceContainer.setup((s) => s.get(IDisposableRegistry)).returns(() => []);
        keys.forEach((item) => {
            const locator = TypeMoq.Mock.ofType<IEnvironmentLocatorService>();
            const locatorPromise = createDeferred<PartialPythonEnvironment[]>();
            locator.setup((l) => l.getEnvironments(resource, TypeMoq.It.isAny())).returns(() => locatorPromise.promise);
            locator
                .setup((l) => l.getEnvironments(anotherResource, TypeMoq.It.isAny()))
                .returns(() => locatorPromise.promise);
            locators.push(locator);
            locatorPromises.push(locatorPromise);
            serviceContainer.setup((s) => s.get(IEnvironmentLocatorService, item)).returns(() => locator.object);
        });
        fileSystem
            .setup((f) => f.arePathsSame(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns((path1: string, path2: string) => path1 === path2);
        fileSystem.setup((f) => f.fileExists(TypeMoq.It.isAny())).returns(() => Promise.resolve(true));
        const completeInfoMap = TypeMoq.Mock.ofType<IPersistentState<Map<string, PythonEnvironment>>>();
        completeInfoMap.setup((c) => c.value).returns(() => new Map<string, PythonEnvironment>());
        persistentState
            .setup((p) => p.createGlobalPersistentState(completeInfoEnvironmentMapKey, TypeMoq.It.isAny()))
            .returns(() => completeInfoMap.object);
        partialInfoMapValue = new Map<string, PartialPythonEnvironment>();
        const partialInfoMap = TypeMoq.Mock.ofType<IPersistentState<Map<string, PartialPythonEnvironment>>>();
        partialInfoMap.setup((c) => c.value).returns(() => partialInfoMapValue);
        persistentState
            .setup((p) => p.createGlobalPersistentState(partialInfoEnvironmentMapKey, TypeMoq.It.isAny()))
            .returns(() => partialInfoMap.object);
        environmentsCollection = new EnvironmentsCollectionService(
            persistentState.object,
            fileSystem.object,
            new EnvironmentInfoService(),
            workspaceService.object,
            serviceContainer.object
        );
    });

    /**
     * Compare only path property to verify if the expected environment is returned. This is because actual environments returned
     * may or may not contain complete info. The processing order is also non-deterministic since we don't know how long each work
     * item will take. So sort before comparing.
     */
    function assertLooseEqual(actual: PartialPythonEnvironment[], expected: PartialPythonEnvironment[]) {
        assert.deepEqual(
            actual.map((environment) => environment.path).sort(),
            expected.map((environment) => environment.path).sort()
        );
    }

    teardown(() => {
        stubShellExec.restore();
    });

    test("Returns list of environments discovered by the first locator which finishes if it's non-empty", async () => {
        const environmentsDiscoveredByLocator4 = [{ path: 'path1' }, { path: 'path2' }, { path: 'path3' }];
        locatorPromises[4].resolve(environmentsDiscoveredByLocator4);
        const environments = await environmentsCollection.getEnvironments(resource);
        assertLooseEqual(environments, environmentsDiscoveredByLocator4);
    });

    test('If list of environments returned by the first locator which finishes is empty, and storage is empty, do not finish execution and wait until atleast one environment is discovered by some other locator', async () => {
        const getEnvironmentsPromise = environmentsCollection.getEnvironments(resource);
        const getEnvironmentsDeferred = createDeferredFromPromise(getEnvironmentsPromise);

        locatorPromises[4].resolve([]);
        await sleep(1);
        expect(getEnvironmentsDeferred.completed).to.equal(
            false,
            'API should wait until atleast one environment is discovered'
        );

        const environmentsDiscoveredByLocator2 = [{ path: 'path1' }, { path: 'path2' }, { path: 'path3' }];
        locatorPromises[2].resolve(environmentsDiscoveredByLocator2);
        await sleep(1);
        expect(getEnvironmentsDeferred.completed).to.equal(true, 'Environments discovered should be returned');

        const environments = await getEnvironmentsPromise;

        assertLooseEqual(environments, environmentsDiscoveredByLocator2);
    });

    test('Return an empty list if list of environments returned by all locators is empty', async () => {
        const getEnvironmentsPromise = environmentsCollection.getEnvironments(resource);
        const getEnvironmentsDeferred = createDeferredFromPromise(getEnvironmentsPromise);
        locatorPromises.forEach((promise) => promise.resolve([]));

        await sleep(1);
        expect(getEnvironmentsDeferred.completed).to.equal(true, 'Environments discovered should be returned');
        const environments = await getEnvironmentsPromise;

        assert.deepEqual(environments, []);
    });

    test('Merge list of environments returned by multiple locators before returning it', async () => {
        const environmentsDiscoveredByLocator3: PartialPythonEnvironment[] = [
            { path: 'path1' },
            { path: 'path2', envType: EnvironmentType.Venv },
            { path: 'path3' }
        ];
        locatorPromises[3].resolve(environmentsDiscoveredByLocator3);
        const environmentsDiscoveredByLocator6: PartialPythonEnvironment[] = [
            { path: 'path2', architecture: Architecture.x86 },
            { path: 'path5' }
        ];
        locatorPromises[6].resolve(environmentsDiscoveredByLocator6);
        await sleep(1);

        const environments = await environmentsCollection.getEnvironments(resource);

        const expectedList = [
            { path: 'path1' },
            { path: 'path2', architecture: Architecture.x86, envType: EnvironmentType.Venv },
            { path: 'path3' },
            { path: 'path5' }
        ];
        assertLooseEqual(environments, expectedList);
    });

    test('If list of environments returned by the first locator which finishes is empty, but the storage is non-empty, do not wait on any other locator and return the storage contents', async () => {
        partialInfoMapValue.set('path1', { path: 'path1' });
        locatorPromises[4].resolve([]);
        const getEnvironmentsPromise = environmentsCollection.getEnvironments(resource);
        const getEnvironmentsDeferred = createDeferredFromPromise(getEnvironmentsPromise);

        await sleep(1);
        expect(getEnvironmentsDeferred.completed).to.equal(true, 'Environments discovered should be returned');
        const environments = await getEnvironmentsPromise;

        assertLooseEqual(environments, [{ path: 'path1' }]);
    });

    test('Ensure onDidChange notifies when an environment gets added to storage', async () => {
        environmentsCollection.getEnvironments(resource).ignoreErrors();
        let onDidChange = false;
        environmentsCollection.onDidChange(() => {
            onDidChange = true;
        });

        const environmentsDiscovered = [{ path: 'path1' }, { path: 'path2' }, { path: 'path3' }];
        locatorPromises[2].resolve(environmentsDiscovered);
        await sleep(1);

        expect(onDidChange).to.equal(true, '');
    });

    test('Returns list of environments with complete info if getCompleteInfoForAllEnvironments option is set to true', async () => {
        const environmentsDiscoveredByLocator = [
            { path: path.join('path1', 'to', 'python'), pipEnvWorkspaceFolder: 'folder' }
        ];
        locatorPromises[4].resolve(environmentsDiscoveredByLocator);

        const environments = await environmentsCollection.getEnvironments(resource, {
            getCompleteInfoForAllEnvironments: true
        });

        const expected = [createExpectedEnvInfo(path.join('path1', 'to', 'python'))];
        expected[0].pipEnvWorkspaceFolder = 'folder';
        assert.deepEqual(environments, expected);
    });

    test('Returns empty list of environments if attempt to fetch complete info fails', async () => {
        stubShellExec.returns(
            new Promise<ExecutionResult<string>>((_resolve, reject) => {
                reject();
            })
        );

        const environmentsDiscoveredByLocator = [
            { path: path.join('path1', 'to', 'python'), pipEnvWorkspaceFolder: 'folder' }
        ];
        locatorPromises[4].resolve(environmentsDiscoveredByLocator);

        const environments = await environmentsCollection.getEnvironments(resource, {
            getCompleteInfoForAllEnvironments: true
        });

        assert.deepEqual(environments, []);
    });

    test('Wait for all locators to discover & store environments before returning list if getAllEnvironments option is set to true', async () => {
        const getEnvironmentsPromise = environmentsCollection.getEnvironments(resource, { getAllEnvironments: true });
        const getEnvironmentsDeferred = createDeferredFromPromise(getEnvironmentsPromise);
        const environmentsDiscoveredByLocator2 = [{ path: path.join('path5', 'to', 'python5') }];
        locatorPromises[5].resolve(environmentsDiscoveredByLocator2);
        await sleep(1);
        expect(getEnvironmentsDeferred.completed).to.equal(false, "All locator promises aren't resolved yet");
        locatorPromises.forEach((locatorPromise, index) =>
            locatorPromise.resolve([{ path: path.join(`path${index}`, 'to', `python${index}`) }])
        );

        await sleep(1);
        expect(getEnvironmentsDeferred.completed).to.equal(true, 'Environments discovered should be returned');
        const environments = await getEnvironmentsPromise;

        const expectedList = [...Array(locatorPromises.length).keys()].map((index) => ({
            path: path.join(`path${index}`, 'to', `python${index}`)
        }));
        assertLooseEqual(environments, expectedList);
    });

    test('Returns list of environments filtered to the resource', async () => {
        const environmentsDiscovered = [
            { path: 'path1', resource: anotherResource },
            { path: 'path2', resource },
            { path: 'path3' }
        ];
        locatorPromises[0].resolve(environmentsDiscovered);
        const environments = await environmentsCollection.getEnvironments(resource);
        assertLooseEqual(environments, [{ path: 'path2', resource }, { path: 'path3' }]);
    });

    test('Custom path added using API is added to the collection', async () => {
        await environmentsCollection.addPath('customPath');
        const environments = await environmentsCollection.getEnvironments(resource);
        assertLooseEqual(environments, [{ path: 'customPath' }]);
    });

    test('Do not trigger discovery using locators for the same resource again if previous promise for resource is still ongoing, but trigger discovery for new resources', async () => {
        locatorPromises[0].resolve([{ path: 'path1' }, { path: 'path2' }, { path: 'path3' }]);
        await environmentsCollection.getEnvironments(resource);
        locators[0].verify((l) => l.getEnvironments(TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
        await environmentsCollection.getEnvironments(resource);
        locators[0].verify((l) => l.getEnvironments(TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
        // However if it's some other resource, discovery is triggered
        await environmentsCollection.getEnvironments(anotherResource);
        locators[0].verify((l) => l.getEnvironments(TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.exactly(2));
    });
});
