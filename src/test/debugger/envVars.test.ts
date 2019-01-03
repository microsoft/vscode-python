// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-string-literal no-unused-expression chai-vague-errors max-func-body-length no-any

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as path from 'path';
import * as shortid from 'shortid';
import { ICurrentProcess, IPathUtils } from '../../client/common/types';
import { IEnvironmentVariablesService } from '../../client/common/variables/types';
import { DebugClientHelper } from '../../client/debugger/debugAdapter/DebugClients/helper';
import { LaunchRequestArguments } from '../../client/debugger/types';
import { closeActiveWindows, initialize, initializeTest } from '../initialize';
import { UnitTestIocContainer } from '../unittests/serviceRegistry';

use(chaiAsPromised);

suite('Resolving Environment Variables when Debugging', () => {
    let ioc: UnitTestIocContainer;
    let helper: DebugClientHelper;
    let pathVariableName: string;
    let mockProcess: ICurrentProcess;
    suiteSetup(initialize);
    setup(async () => {
        initializeDI();
        await initializeTest();
        const envParser = ioc.serviceContainer.get<IEnvironmentVariablesService>(IEnvironmentVariablesService);
        const pathUtils = ioc.serviceContainer.get<IPathUtils>(IPathUtils);
        mockProcess = ioc.serviceContainer.get<ICurrentProcess>(ICurrentProcess);
        helper = new DebugClientHelper(envParser, pathUtils, mockProcess);
        pathVariableName = pathUtils.getPathVariableName();
    });
    suiteTeardown(closeActiveWindows);
    teardown(async () => {
        await ioc.dispose();
        await closeActiveWindows();
    });

    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerProcessTypes();
        ioc.registerVariableTypes();
        ioc.registerMockProcess();
    }

    async function testBasicProperties(console: 'externalTerminal' | 'integratedTerminal' | 'none', expectedNumberOfVariables: number) {
        const args = {
            program: '', pythonPath: '', args: [], envFile: '',
            console
            // tslint:disable-next-line:no-any
        } as any as LaunchRequestArguments;

        const envVars = await helper.getEnvironmentVariables(args);
        expect(envVars).not.be.undefined;
        expect(Object.keys(envVars)).lengthOf(expectedNumberOfVariables, 'Incorrect number of variables');
        expect(envVars).to.have.property('PYTHONUNBUFFERED', '1', 'Property not found');
        expect(envVars).to.have.property('PYTHONIOENCODING', 'UTF-8', 'Property not found');
    }

    test('Confirm basic environment variables exist when launched in external terminal', () => testBasicProperties('externalTerminal', 2));

    test('Confirm basic environment variables exist when launched in intergrated terminal', () => testBasicProperties('integratedTerminal', 2));

    test('Confirm basic environment variables exist when launched in debug console', async () => {
        let expectedNumberOfVariables = Object.keys(mockProcess.env).length;
        if (mockProcess.env['PYTHONUNBUFFERED'] === undefined) {
            expectedNumberOfVariables += 1;
        }
        if (mockProcess.env['PYTHONIOENCODING'] === undefined) {
            expectedNumberOfVariables += 1;
        }
        await testBasicProperties('none', expectedNumberOfVariables);
    });

    async function testJsonEnvVariables(console: 'externalTerminal' | 'integratedTerminal' | 'none', expectedNumberOfVariables: number) {
        const prop1 = shortid.generate();
        const prop2 = shortid.generate();
        const prop3 = shortid.generate();
        const env = {};
        env[prop1] = prop1;
        env[prop2] = prop2;
        mockProcess.env[prop3] = prop3;

        const args = {
            program: '', pythonPath: '', args: [], envFile: '',
            console, env
        // tslint:disable-next-line:no-any
        } as any as LaunchRequestArguments;

        const envVars = await helper.getEnvironmentVariables(args);

        // tslint:disable-next-line:no-unused-expression chai-vague-errors
        expect(envVars).not.be.undefined;
        expect(Object.keys(envVars)).lengthOf(expectedNumberOfVariables, 'Incorrect number of variables');
        expect(envVars).to.have.property('PYTHONUNBUFFERED', '1', 'Property not found');
        expect(envVars).to.have.property('PYTHONIOENCODING', 'UTF-8', 'Property not found');
        expect(envVars).to.have.property(prop1, prop1, 'Property not found');
        expect(envVars).to.have.property(prop2, prop2, 'Property not found');

        if (console === 'none') {
            expect(envVars).to.have.property(prop3, prop3, 'Property not found');
        } else {
            expect(envVars).not.to.have.property(prop3, prop3, 'Property not found');
        }
    }

    test('Confirm json environment variables exist when launched in external terminal', () => testJsonEnvVariables('externalTerminal', 2 + 2));

    test('Confirm json environment variables exist when launched in intergrated terminal', () => testJsonEnvVariables('integratedTerminal', 2 + 2));

    test('Confirm json environment variables exist when launched in debug console', async () => {
        // Add 3 for the 3 new json env variables
        let expectedNumberOfVariables = Object.keys(mockProcess.env).length + 3;
        if (mockProcess.env['PYTHONUNBUFFERED'] === undefined) {
            expectedNumberOfVariables += 1;
        }
        if (mockProcess.env['PYTHONIOENCODING'] === undefined) {
            expectedNumberOfVariables += 1;
        }
        await testJsonEnvVariables('none', expectedNumberOfVariables);
    });

    async function testAppendingOfPaths(console: 'externalTerminal' | 'integratedTerminal' | 'none',
        expectedNumberOfVariables: number, removePythonPath: boolean) {
        if (removePythonPath && mockProcess.env.PYTHONPATH !== undefined) {
            delete mockProcess.env.PYTHONPATH;
        }

        const customPathToAppend = shortid.generate();
        const customPythonPathToAppend = shortid.generate();
        const prop1 = shortid.generate();
        const prop2 = shortid.generate();
        const prop3 = shortid.generate();

        const env = {};
        env[pathVariableName] = customPathToAppend;
        env['PYTHONPATH'] = customPythonPathToAppend;
        env[prop1] = prop1;
        env[prop2] = prop2;
        mockProcess.env[prop3] = prop3;

        const args = {
            program: '', pythonPath: '', args: [], envFile: '',
            console, env
        } as any as LaunchRequestArguments;

        const envVars = await helper.getEnvironmentVariables(args);
        expect(envVars).not.be.undefined;
        expect(Object.keys(envVars)).lengthOf(expectedNumberOfVariables, 'Incorrect number of variables');
        expect(envVars).to.have.property('PYTHONPATH');
        expect(envVars).to.have.property(pathVariableName);
        expect(envVars).to.have.property('PYTHONUNBUFFERED', '1', 'Property not found');
        expect(envVars).to.have.property('PYTHONIOENCODING', 'UTF-8', 'Property not found');
        expect(envVars).to.have.property(prop1, prop1, 'Property not found');
        expect(envVars).to.have.property(prop2, prop2, 'Property not found');

        if (console === 'none') {
            expect(envVars).to.have.property(prop3, prop3, 'Property not found');
        } else {
            expect(envVars).not.to.have.property(prop3, prop3, 'Property not found');
        }

        // Confirm the paths have been appended correctly.
        const expectedPath = customPathToAppend + path.delimiter + mockProcess.env[pathVariableName];
        expect(envVars).to.have.property(pathVariableName, expectedPath, 'PATH is not correct');

        // Confirm the paths have been appended correctly.
        let expectedPythonPath = customPythonPathToAppend;
        if (typeof mockProcess.env.PYTHONPATH === 'string' && mockProcess.env.PYTHONPATH.length > 0) {
            expectedPythonPath = customPythonPathToAppend + path.delimiter + mockProcess.env.PYTHONPATH;
        }
        expect(envVars).to.have.property('PYTHONPATH', expectedPythonPath, 'PYTHONPATH is not correct');

        if (console === 'none') {
            // All variables in current process must be in here
            expect(Object.keys(envVars).length).greaterThan(Object.keys(mockProcess.env).length, 'Variables is not a subset');
            Object.keys(mockProcess.env).forEach(key => {
                if (key === pathVariableName || key === 'PYTHONPATH') {
                    return;
                }
                expect(mockProcess.env[key]).equal(envVars[key], `Value for the environment variable '${key}' is incorrect.`);
            });
        }
    }

    test('Confirm paths get appended correctly when using json variables and launched in external terminal', () => testAppendingOfPaths('externalTerminal', 6, false));

    test('Confirm paths get appended correctly when using json variables and launched in integrated terminal', () => testAppendingOfPaths('integratedTerminal', 6, false));

    test('Confirm paths get appended correctly when using json variables and launched in debug console', async () => {
        // Add 3 for the 3 new json env variables
        let expectedNumberOfVariables = Object.keys(mockProcess.env).length + 3;
        if (mockProcess.env['PYTHONUNBUFFERED'] === undefined) {
            expectedNumberOfVariables += 1;
        }
        if (mockProcess.env['PYTHONPATH'] === undefined) {
            expectedNumberOfVariables += 1;
        }
        if (mockProcess.env['PYTHONIOENCODING'] === undefined) {
            expectedNumberOfVariables += 1;
        }
        await testAppendingOfPaths('none', expectedNumberOfVariables, false);
    });
});
