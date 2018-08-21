// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { Uri } from 'vscode';
import { EnumEx } from '../../../client/common/enumUtils';
import { Architecture, IPlatformService } from '../../../client/common/platform/types';
import { IDisposableRegistry } from '../../../client/common/types';
import { CONDA_ENV_FILE_SERVICE, CONDA_ENV_SERVICE, CURRENT_PATH_SERVICE, GLOBAL_VIRTUAL_ENV_SERVICE, IInterpreterLocatorHelper, IInterpreterLocatorService, InterpreterType, KNOWN_PATH_SERVICE, PIPENV_SERVICE, PythonInterpreter, WINDOWS_REGISTRY_SERVICE, WORKSPACE_VIRTUAL_ENV_SERVICE } from '../../../client/interpreter/contracts';
import { PythonInterpreterLocatorService } from '../../../client/interpreter/locators';
import { IServiceContainer } from '../../../client/ioc/types';

enum OS {
    Windows, Linux, Mac
}

suite('Interpreters - Locators Index', () => {
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let platform: TypeMoq.IMock<IPlatformService>;
    let helper: TypeMoq.IMock<IInterpreterLocatorHelper>;
    let locator: IInterpreterLocatorService;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        platform = TypeMoq.Mock.ofType<IPlatformService>();
        helper = TypeMoq.Mock.ofType<IInterpreterLocatorHelper>();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IDisposableRegistry))).returns(() => []);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IPlatformService))).returns(() => platform.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IInterpreterLocatorHelper))).returns(() => helper.object);

        locator = new PythonInterpreterLocatorService(serviceContainer.object);
    });
    [undefined, Uri.file('Something')].forEach(resource => {
        EnumEx.getNamesAndValues<OS>(OS).forEach(os => {
            const testSuffix = `(on ${os.name}, with${resource ? '' : 'out'} a resource)`;
            test(`All Interpreter Sources are used ${testSuffix}`, async () => {
                const locatorsTypes: string[] = [];
                if (os.value === OS.Windows) {
                    locatorsTypes.push(WINDOWS_REGISTRY_SERVICE);
                }
                platform.setup(p => p.isWindows).returns(() => os.value === OS.Windows);
                platform.setup(p => p.isLinux).returns(() => os.value === OS.Linux);
                platform.setup(p => p.isMac).returns(() => os.value === OS.Mac);

                locatorsTypes.push(CONDA_ENV_SERVICE);
                locatorsTypes.push(CONDA_ENV_FILE_SERVICE);
                locatorsTypes.push(PIPENV_SERVICE);
                locatorsTypes.push(GLOBAL_VIRTUAL_ENV_SERVICE);
                locatorsTypes.push(WORKSPACE_VIRTUAL_ENV_SERVICE);

                if (os.value !== OS.Windows) {
                    locatorsTypes.push(KNOWN_PATH_SERVICE);
                }
                locatorsTypes.push(CURRENT_PATH_SERVICE);

                const locatorsWithInterpreters = locatorsTypes.map(typeName => {
                    const interpreter: PythonInterpreter = {
                        architecture: Architecture.Unknown,
                        displayName: typeName,
                        path: typeName,
                        sysPrefix: typeName,
                        sysVersion: typeName,
                        type: InterpreterType.Unknown,
                        version: typeName,
                        version_info: [0, 0, 0, 'alpha']
                    };

                    const typeLocator = TypeMoq.Mock.ofType<IInterpreterLocatorService>();
                    typeLocator
                        .setup(l => l.getInterpreters(TypeMoq.It.isValue(resource)))
                        .returns(() => Promise.resolve([interpreter]))
                        .verifiable(TypeMoq.Times.once());

                    serviceContainer
                        .setup(c => c.get(TypeMoq.It.isValue(IInterpreterLocatorService), TypeMoq.It.isValue(typeName)))
                        .returns(() => typeLocator.object);

                    return {
                        type: typeName,
                        locator: typeLocator,
                        interpreters: [interpreter]
                    };
                });

                helper
                    .setup(h => h.mergeInterpreters(TypeMoq.It.isAny()))
                    .returns(() => locatorsWithInterpreters.map(item => item.interpreters[0]))
                    .verifiable(TypeMoq.Times.once());

                await locator.getInterpreters(resource);

                locatorsWithInterpreters.forEach(item => item.locator.verifyAll());
                helper.verifyAll();
            });
            test(`Interpreter Sources are sorted correctly and merged ${testSuffix}`, async () => {
                const locatorsTypes: string[] = [];
                if (os.value === OS.Windows) {
                    locatorsTypes.push(WINDOWS_REGISTRY_SERVICE);
                }
                platform.setup(p => p.isWindows).returns(() => os.value === OS.Windows);
                platform.setup(p => p.isLinux).returns(() => os.value === OS.Linux);
                platform.setup(p => p.isMac).returns(() => os.value === OS.Mac);

                locatorsTypes.push(CONDA_ENV_SERVICE);
                locatorsTypes.push(CONDA_ENV_FILE_SERVICE);
                locatorsTypes.push(PIPENV_SERVICE);
                locatorsTypes.push(GLOBAL_VIRTUAL_ENV_SERVICE);
                locatorsTypes.push(WORKSPACE_VIRTUAL_ENV_SERVICE);

                if (os.value !== OS.Windows) {
                    locatorsTypes.push(KNOWN_PATH_SERVICE);
                }
                locatorsTypes.push(CURRENT_PATH_SERVICE);

                const locatorsWithInterpreters = locatorsTypes.map(typeName => {
                    const interpreter: PythonInterpreter = {
                        architecture: Architecture.Unknown,
                        displayName: typeName,
                        path: typeName,
                        sysPrefix: typeName,
                        sysVersion: typeName,
                        type: InterpreterType.Unknown,
                        version: typeName,
                        version_info: [0, 0, 0, 'alpha']
                    };

                    const typeLocator = TypeMoq.Mock.ofType<IInterpreterLocatorService>();
                    typeLocator
                        .setup(l => l.getInterpreters(TypeMoq.It.isValue(resource)))
                        .returns(() => Promise.resolve([interpreter]))
                        .verifiable(TypeMoq.Times.once());

                    serviceContainer
                        .setup(c => c.get(TypeMoq.It.isValue(IInterpreterLocatorService), TypeMoq.It.isValue(typeName)))
                        .returns(() => typeLocator.object);

                    return {
                        type: typeName,
                        locator: typeLocator,
                        interpreters: [interpreter]
                    };
                });

                const expectedInterpreters = locatorsWithInterpreters.map(item => item.interpreters[0]);
                helper
                    .setup(h => h.mergeInterpreters(TypeMoq.It.isAny()))
                    .returns(() => expectedInterpreters)
                    .verifiable(TypeMoq.Times.once());

                const interpreters = await locator.getInterpreters(resource);

                locatorsWithInterpreters.forEach(item => item.locator.verifyAll());
                helper.verifyAll();
                expect(interpreters).to.be.lengthOf(locatorsTypes.length);
                expect(interpreters).to.be.deep.equal(expectedInterpreters);
            });
        });
    });
});
