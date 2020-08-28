// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length

import { expect } from 'chai';
import { SemVer } from 'semver';
import * as TypeMoq from 'typemoq';
import { Uri } from 'vscode';
import { IPlatformService } from '../../../../client/common/platform/types';
import { IDisposableRegistry } from '../../../../client/common/types';
import { getNamesAndValues } from '../../../../client/common/utils/enum';
import { Architecture, OSType } from '../../../../client/common/utils/platform';
import {
    CONDA_ENV_FILE_SERVICE,
    CONDA_ENV_SERVICE,
    CURRENT_PATH_SERVICE,
    GLOBAL_VIRTUAL_ENV_SERVICE,
    IInterpreterLocatorHelper,
    IInterpreterLocatorService,
    KNOWN_PATH_SERVICE,
    PIPENV_SERVICE,
    WINDOWS_REGISTRY_SERVICE,
    WORKSPACE_VIRTUAL_ENV_SERVICE,
} from '../../../../client/interpreter/contracts';
import { IServiceContainer } from '../../../../client/ioc/types';
import { PythonInterpreterLocatorService } from '../../../../client/pythonEnvironments/discovery/locators';
import { EnvironmentType, PythonEnvironment } from '../../../../client/pythonEnvironments/info';

suite('Interpreters - Locators Index', () => {
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let platformSvc: TypeMoq.IMock<IPlatformService>;
    let helper: TypeMoq.IMock<IInterpreterLocatorHelper>;
    let locator: IInterpreterLocatorService;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        platformSvc = TypeMoq.Mock.ofType<IPlatformService>();
        helper = TypeMoq.Mock.ofType<IInterpreterLocatorHelper>();
        serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(IDisposableRegistry))).returns(() => []);
        serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(IPlatformService))).returns(() => platformSvc.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IInterpreterLocatorHelper)))
            .returns(() => helper.object);

        locator = new PythonInterpreterLocatorService(serviceContainer.object);
    });
    [undefined, Uri.file('Something')].forEach((resource) => {
        getNamesAndValues<OSType>(OSType).forEach((osType) => {
            if (osType.value === OSType.Unknown) {
                return;
            }
            const testSuffix = `(on ${osType.name}, with${resource ? '' : 'out'} a resource)`;
            test(`All Interpreter Sources are used ${testSuffix}`, async () => {
                const locatorsTypes: string[] = [];
                if (osType.value === OSType.Windows) {
                    locatorsTypes.push(WINDOWS_REGISTRY_SERVICE);
                }
                platformSvc.setup((p) => p.osType).returns(() => osType.value);
                platformSvc.setup((p) => p.isWindows).returns(() => osType.value === OSType.Windows);
                platformSvc.setup((p) => p.isLinux).returns(() => osType.value === OSType.Linux);
                platformSvc.setup((p) => p.isMac).returns(() => osType.value === OSType.OSX);

                locatorsTypes.push(CONDA_ENV_SERVICE);
                locatorsTypes.push(CONDA_ENV_FILE_SERVICE);
                locatorsTypes.push(PIPENV_SERVICE);
                locatorsTypes.push(GLOBAL_VIRTUAL_ENV_SERVICE);
                locatorsTypes.push(WORKSPACE_VIRTUAL_ENV_SERVICE);
                locatorsTypes.push(KNOWN_PATH_SERVICE);
                locatorsTypes.push(CURRENT_PATH_SERVICE);

                const locatorsWithInterpreters = locatorsTypes.map((typeName) => {
                    const interpreter: PythonEnvironment = {
                        architecture: Architecture.Unknown,
                        displayName: typeName,
                        path: typeName,
                        sysPrefix: typeName,
                        sysVersion: typeName,
                        envType: EnvironmentType.Unknown,
                        version: new SemVer('0.0.0-alpha'),
                    };

                    const typeLocator = TypeMoq.Mock.ofType<IInterpreterLocatorService>();
                    typeLocator
                        .setup((l) => l.hasInterpreters)
                        .returns(() => Promise.resolve(true))
                        .verifiable(TypeMoq.Times.once());

                    typeLocator
                        .setup((l) => l.getInterpreters(TypeMoq.It.isValue(resource)))
                        .returns(() => Promise.resolve([interpreter]))
                        .verifiable(TypeMoq.Times.once());

                    serviceContainer
                        .setup((c) => c.get(TypeMoq.It.isValue(IInterpreterLocatorService), TypeMoq.It.isValue(typeName)))
                        .returns(() => typeLocator.object);

                    return {
                        type: typeName,
                        locator: typeLocator,
                        interpreters: [interpreter],
                    };
                });

                helper
                    .setup((h) => h.mergeInterpreters(TypeMoq.It.isAny()))
                    .returns(() => Promise.resolve(locatorsWithInterpreters.map((item) => item.interpreters[0])))
                    .verifiable(TypeMoq.Times.once());

                await locator.getInterpreters(resource);

                locatorsWithInterpreters.forEach((item) => item.locator.verifyAll());
                helper.verifyAll();
            });
            test(`Interpreter Sources are sorted correctly and merged ${testSuffix}`, async () => {
                const locatorsTypes: string[] = [];
                if (osType.value === OSType.Windows) {
                    locatorsTypes.push(WINDOWS_REGISTRY_SERVICE);
                }
                platformSvc.setup((p) => p.osType).returns(() => osType.value);
                platformSvc.setup((p) => p.isWindows).returns(() => osType.value === OSType.Windows);
                platformSvc.setup((p) => p.isLinux).returns(() => osType.value === OSType.Linux);
                platformSvc.setup((p) => p.isMac).returns(() => osType.value === OSType.OSX);

                locatorsTypes.push(CONDA_ENV_SERVICE);
                locatorsTypes.push(CONDA_ENV_FILE_SERVICE);
                locatorsTypes.push(PIPENV_SERVICE);
                locatorsTypes.push(GLOBAL_VIRTUAL_ENV_SERVICE);
                locatorsTypes.push(WORKSPACE_VIRTUAL_ENV_SERVICE);
                locatorsTypes.push(KNOWN_PATH_SERVICE);
                locatorsTypes.push(CURRENT_PATH_SERVICE);

                const locatorsWithInterpreters = locatorsTypes.map((typeName) => {
                    const interpreter: PythonEnvironment = {
                        architecture: Architecture.Unknown,
                        displayName: typeName,
                        path: typeName,
                        sysPrefix: typeName,
                        sysVersion: typeName,
                        envType: EnvironmentType.Unknown,
                        version: new SemVer('0.0.0-alpha'),
                    };

                    const typeLocator = TypeMoq.Mock.ofType<IInterpreterLocatorService>();
                    typeLocator
                        .setup((l) => l.hasInterpreters)
                        .returns(() => Promise.resolve(true))
                        .verifiable(TypeMoq.Times.once());

                    typeLocator
                        .setup((l) => l.getInterpreters(TypeMoq.It.isValue(resource)))
                        .returns(() => Promise.resolve([interpreter]))
                        .verifiable(TypeMoq.Times.once());

                    serviceContainer
                        .setup((c) => c.get(TypeMoq.It.isValue(IInterpreterLocatorService), TypeMoq.It.isValue(typeName)))
                        .returns(() => typeLocator.object);

                    return {
                        type: typeName,
                        locator: typeLocator,
                        interpreters: [interpreter],
                    };
                });

                const expectedInterpreters = locatorsWithInterpreters.map((item) => item.interpreters[0]);

                helper
                    .setup((h) => h.mergeInterpreters(TypeMoq.It.isAny()))
                    .returns(() => Promise.resolve(expectedInterpreters))
                    .verifiable(TypeMoq.Times.once());

                const interpreters = await locator.getInterpreters(resource);

                locatorsWithInterpreters.forEach((item) => item.locator.verifyAll());
                helper.verifyAll();
                expect(interpreters).to.be.deep.equal(expectedInterpreters);
            });
            test(`didTriggerInterpreterSuggestions is set to true in the locators if onSuggestion is true ${testSuffix}`, async () => {
                const locatorsTypes: string[] = [];
                if (osType.value === OSType.Windows) {
                    locatorsTypes.push(WINDOWS_REGISTRY_SERVICE);
                }
                platformSvc.setup((p) => p.osType).returns(() => osType.value);
                platformSvc.setup((p) => p.isWindows).returns(() => osType.value === OSType.Windows);
                platformSvc.setup((p) => p.isLinux).returns(() => osType.value === OSType.Linux);
                platformSvc.setup((p) => p.isMac).returns(() => osType.value === OSType.OSX);

                locatorsTypes.push(CONDA_ENV_SERVICE);
                locatorsTypes.push(CONDA_ENV_FILE_SERVICE);
                locatorsTypes.push(PIPENV_SERVICE);
                locatorsTypes.push(GLOBAL_VIRTUAL_ENV_SERVICE);
                locatorsTypes.push(WORKSPACE_VIRTUAL_ENV_SERVICE);
                locatorsTypes.push(KNOWN_PATH_SERVICE);
                locatorsTypes.push(CURRENT_PATH_SERVICE);

                const locatorsWithInterpreters = locatorsTypes.map((typeName) => {
                    const interpreter: PythonEnvironment = {
                        architecture: Architecture.Unknown,
                        displayName: typeName,
                        path: typeName,
                        sysPrefix: typeName,
                        sysVersion: typeName,
                        envType: EnvironmentType.Unknown,
                        version: new SemVer('0.0.0-alpha'),
                    };

                    const typeLocator = TypeMoq.Mock.ofType<IInterpreterLocatorService>();
                    typeLocator
                        .setup((l) => l.hasInterpreters)
                        .returns(() => Promise.resolve(true))
                        .verifiable(TypeMoq.Times.once());

                    typeLocator
                        .setup((l) => l.getInterpreters(TypeMoq.It.isValue(resource)))
                        .returns(() => Promise.resolve([interpreter]))
                        .verifiable(TypeMoq.Times.once());

                    serviceContainer
                        .setup((c) => c.get(TypeMoq.It.isValue(IInterpreterLocatorService), TypeMoq.It.isValue(typeName)))
                        .returns(() => typeLocator.object);

                    return {
                        type: typeName,
                        locator: typeLocator,
                        interpreters: [interpreter],
                    };
                });

                helper
                    .setup((h) => h.mergeInterpreters(TypeMoq.It.isAny()))
                    .returns(() => Promise.resolve(locatorsWithInterpreters.map((item) => item.interpreters[0])));

                await locator.getInterpreters(resource, { onSuggestion: true });

                locatorsWithInterpreters.forEach((item) => item.locator.verify(
                    (l) => (l.didTriggerInterpreterSuggestions = true), TypeMoq.Times.once(),
                ));
                expect(locator.didTriggerInterpreterSuggestions).to.equal(
                    true,
                    'didTriggerInterpreterSuggestions should be set to true.',
                );
            });
        });
    });
});
