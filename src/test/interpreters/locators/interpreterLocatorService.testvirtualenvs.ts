// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as path from 'path';
import { RegistryImplementation } from '../../../client/common/platform/registry';
import { IRegistry } from '../../../client/common/platform/types';
import { IInterpreterLocatorService, INTERPRETER_LOCATOR_SERVICE, InterpreterType } from '../../../client/interpreter/contracts';
import { initialize, initializeTest } from '../../initialize';
import { UnitTestIocContainer } from '../../testing/serviceRegistry';

suite('Python interpreter locator service', () => {
    let ioc: UnitTestIocContainer;
    suiteSetup(async () => {
        await initialize();
    });

    setup(async () => {
        await initializeTest();
        initializeDI();
    });

    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerUnitTestTypes();
        ioc.registerVariableTypes();
        ioc.registerInterpreterTypes();
        ioc.serviceManager.addSingleton<IRegistry>(IRegistry, RegistryImplementation);
    }

    test('xEnsure we are getting all conda environments', async () => {
        // tslint:disable: no-console
        console.time('Time taken to run test');
        const locator = ioc.serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, INTERPRETER_LOCATOR_SERVICE);
        const interpreters = await locator.getInterpreters();
        interpreters.forEach(i => {
            // tslint:disable: no-console
            console.log(`${i.path} | ${i.envName}`);
        });
        // Created in CI using command `conda create -n "test_env1" -y python`
        let filteredInterpreters = interpreters.filter(i => i.envName === 'test_env1' && i.type === InterpreterType.Conda);
        filteredInterpreters.forEach(i => {
            // tslint:disable-next-line: no-console
            console.log(`1 ${i.path} | ${i.envName}`);
        });
        expect(filteredInterpreters.length).to.be.greaterThan(0, 'Environment test_env1 not found');
        console.log('After 1');

        // Created in CI using command `conda create -p "./test_env2" -y python`
        filteredInterpreters = interpreters.filter(i => {
            let dirName = path.dirname(i.path);
            if (dirName.endsWith('bin') || dirName.endsWith('Scripts')) {
                dirName = path.dirname(dirName);
            }
            return dirName.endsWith('test_env2') && i.type === InterpreterType.Conda;
        });
        filteredInterpreters.forEach(i => {
            // tslint:disable-next-line: no-console
            console.log(`2 ${i.path} | ${i.envName}`);
        });
        expect(filteredInterpreters.length).to.be.greaterThan(0, 'Environment test_env2 not found');
        console.log('After 2');

        // Created in CI using command `conda create -p "<HOME>/test_env3" -y python`
        filteredInterpreters = interpreters.filter(i => {
            let dirName = path.dirname(i.path);
            if (dirName.endsWith('bin') || dirName.endsWith('Scripts')) {
                dirName = path.dirname(dirName);
            }
            return dirName.endsWith('test_env3') && i.type === InterpreterType.Conda;
        });
        filteredInterpreters.forEach(i => {
            // tslint:disable-next-line: no-console
            console.log(`3 ${i.path} | ${i.envName}`);
        });
        expect(filteredInterpreters.length).to.be.greaterThan(0, 'Environment test_env3 not found');
        console.log('After 3');

        // Base conda environment in CI
        filteredInterpreters = interpreters.filter(i => (i.envName === 'base' || i.envName === 'miniconda') && i.type === InterpreterType.Conda);
        filteredInterpreters.forEach(i => {
            // tslint:disable-next-line: no-console
            console.log(`4 ${i.path} | ${i.envName}`);
        });
        expect(filteredInterpreters.length).to.be.greaterThan(0, 'Environment base not found');
        console.log('After 4');
        interpreters.forEach(i => {
            // tslint:disable-next-line: no-console
            console.log(`${i.path} | ${i.envName}`);
        });
        console.timeEnd('Time taken to run test');
    });
});
