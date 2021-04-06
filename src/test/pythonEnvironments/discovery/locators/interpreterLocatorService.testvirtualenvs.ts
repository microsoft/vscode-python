// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as path from 'path';
import { RegistryImplementation } from '../../../../client/common/platform/registry';
import { IRegistry } from '../../../../client/common/platform/types';
import { IInterpreterLocatorService, INTERPRETER_LOCATOR_SERVICE } from '../../../../client/interpreter/contracts';
import { EnvironmentType, PythonEnvironment } from '../../../../client/pythonEnvironments/info';
import { getOSType, OSType } from '../../../common';
import { TEST_TIMEOUT } from '../../../constants';
import { closeActiveWindows, initialize, initializeTest } from '../../../initialize';
import { UnitTestIocContainer } from '../../../testing/serviceRegistry';

suite('Python interpreter locator service', () => {
    let ioc: UnitTestIocContainer;
    let interpreters: PythonEnvironment[];
    suiteSetup(async function () {
        // https://github.com/microsoft/vscode-python/issues/12634

        return this.skip();

        this.timeout(getOSType() === OSType.Windows ? TEST_TIMEOUT * 7 : TEST_TIMEOUT * 2);
        await initialize();
        await initializeDI();
        const locator = ioc.serviceContainer.get<IInterpreterLocatorService>(
            IInterpreterLocatorService,
            INTERPRETER_LOCATOR_SERVICE,
        );
        interpreters = await locator.getInterpreters();
    });

    setup(async () => {
        await initializeTest();
        await initializeDI();
    });

    teardown(async () => {
        await ioc.dispose();
        await closeActiveWindows();
    });
    suiteTeardown(closeActiveWindows);

    async function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerUnitTestTypes();
        ioc.registerMockProcessTypes();
        ioc.registerVariableTypes();
        ioc.registerInterpreterTypes();
        ioc.serviceManager.addSingleton<IRegistry>(IRegistry, RegistryImplementation);
    }

    test('Ensure we are getting conda environment created using command `conda create -n "test_env1" -y python`', async () => {
        // Created in CI using command `conda create -n "test_env1" -y python`
        const filteredInterpreters = interpreters.filter(
            (i) => i.envName === 'test_env1' && i.envType === EnvironmentType.Conda,
        );
        expect(filteredInterpreters.length).to.be.greaterThan(0, 'Environment test_env1 not found');
    });
    test('Ensure we are getting conda environment created using command `conda create -p "./test_env2`"', async () => {
        // Created in CI using command `conda create -p "./test_env2" -y python`
        const filteredInterpreters = interpreters.filter((i) => {
            let dirName = path.dirname(i.path);
            if (dirName.endsWith('bin') || dirName.endsWith('Scripts')) {
                dirName = path.dirname(dirName);
            }
            return dirName.endsWith('test_env2') && i.envType === EnvironmentType.Conda;
        });
        expect(filteredInterpreters.length).to.be.greaterThan(0, 'Environment test_env2 not found');
    });
    test('Ensure we are getting conda environment created using command `conda create -p "<HOME>/test_env3" -y python`', async () => {
        // Created in CI using command `conda create -p "<HOME>/test_env3" -y python`
        const filteredInterpreters = interpreters.filter((i) => {
            let dirName = path.dirname(i.path);
            if (dirName.endsWith('bin') || dirName.endsWith('Scripts')) {
                dirName = path.dirname(dirName);
            }
            return dirName.endsWith('test_env3') && i.envType === EnvironmentType.Conda;
        });
        expect(filteredInterpreters.length).to.be.greaterThan(0, 'Environment test_env3 not found');
    });

    test('Ensure we are getting the base conda environment', async () => {
        // Base conda environment in CI
        const filteredInterpreters = interpreters.filter(
            (i) => (i.envName === 'base' || i.envName === 'miniconda') && i.envType === EnvironmentType.Conda,
        );
        expect(filteredInterpreters.length).to.be.greaterThan(0, 'Base environment not found');
    });
});
