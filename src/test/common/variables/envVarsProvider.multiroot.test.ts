// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as fs from 'fs-extra';
import { EOL } from 'os';
import * as path from 'path';
import { ConfigurationTarget, Disposable, Uri, workspace } from 'vscode';
import { IS_WINDOWS, NON_WINDOWS_PATH_VARIABLE_NAME, WINDOWS_PATH_VARIABLE_NAME } from '../../../client/common/platform/constants';
import { IDisposableRegistry, IPathUtils, IsWindows } from '../../../client/common/types';
import { createDeferred } from '../../../client/common/utils/async';
import { EnvironmentVariablesService } from '../../../client/common/variables/environment';
import { EnvironmentVariablesProvider } from '../../../client/common/variables/environmentVariablesProvider';
import { EnvironmentVariables } from '../../../client/common/variables/types';
import { clearPythonPathInWorkspaceFolder, updateSetting } from '../../common';
import { closeActiveWindows, initialize, initializeTest, IS_MULTI_ROOT_TEST } from '../../initialize';
import { MockProcess } from '../../mocks/process';
import { UnitTestIocContainer } from '../../unittests/serviceRegistry';

use(chaiAsPromised);

const multirootPath = path.join(__dirname, '..', '..', '..', '..', 'src', 'testMultiRootWkspc');
const workspace4Path = Uri.file(path.join(multirootPath, 'workspace4'));
const workspace4PyFile = Uri.file(path.join(workspace4Path.fsPath, 'one.py'));

// tslint:disable-next-line:max-func-body-length
suite('Multiroot Environment Variables Provider', () => {
    let ioc: UnitTestIocContainer;
    const pathVariableName = IS_WINDOWS ? WINDOWS_PATH_VARIABLE_NAME : NON_WINDOWS_PATH_VARIABLE_NAME;
    suiteSetup(async function () {
        if (!IS_MULTI_ROOT_TEST) {
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }
        await clearPythonPathInWorkspaceFolder(workspace4Path);
        await updateSetting('envFile', undefined, workspace4PyFile, ConfigurationTarget.WorkspaceFolder);
        await initialize();
    });
    setup(() => {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerVariableTypes();
        ioc.registerProcessTypes();
        return initializeTest();
    });
    suiteTeardown(closeActiveWindows);
    teardown(async () => {
        ioc.dispose();
        await closeActiveWindows();
        await clearPythonPathInWorkspaceFolder(workspace4Path);
        await updateSetting('envFile', undefined, workspace4PyFile, ConfigurationTarget.WorkspaceFolder);
        await initializeTest();
    });

    function getVariablesProvider(mockVariables: EnvironmentVariables = { ...process.env }) {
        const pathUtils = ioc.serviceContainer.get<IPathUtils>(IPathUtils);
        const mockProcess = new MockProcess(mockVariables);
        const variablesService = new EnvironmentVariablesService(pathUtils);
        const disposables = ioc.serviceContainer.get<Disposable[]>(IDisposableRegistry);
        const isWindows = ioc.serviceContainer.get<boolean>(IsWindows);
        return new EnvironmentVariablesProvider(variablesService, disposables, isWindows, mockProcess);
    }

    test('Custom variables should not be undefined without an env file', async () => {
        await updateSetting('envFile', 'someInvalidFile.env', workspace4PyFile, ConfigurationTarget.WorkspaceFolder);
        const envProvider = getVariablesProvider();
        const vars = envProvider.getEnvironmentVariables(workspace4PyFile);
        await expect(vars).to.eventually.not.equal(undefined, 'Variables is not undefiend');
    });

    test('Custom variables should be parsed from env file', async () => {
        // tslint:disable-next-line:no-invalid-template-strings
        await updateSetting('envFile', '${workspaceRoot}/.env', workspace4PyFile, ConfigurationTarget.WorkspaceFolder);
        const processVariables = { ...process.env };
        if (processVariables.PYTHONPATH) {
            delete processVariables.PYTHONPATH;
        }
        const envProvider = getVariablesProvider(processVariables);
        const vars = await envProvider.getEnvironmentVariables(workspace4PyFile);

        expect(vars).to.not.equal(undefined, 'Variables is is undefiend');
        expect(vars).to.have.property('X1234PYEXTUNITTESTVAR', '1234', 'X1234PYEXTUNITTESTVAR value is invalid');
        expect(vars).to.have.property('PYTHONPATH', '../workspace5', 'PYTHONPATH value is invalid');
    });

    test('All process environment variables should be included in variables returned', async () => {
        // tslint:disable-next-line:no-invalid-template-strings
        await updateSetting('envFile', '${workspaceRoot}/.env', workspace4PyFile, ConfigurationTarget.WorkspaceFolder);
        const processVariables = { ...process.env };
        if (processVariables.PYTHONPATH) {
            delete processVariables.PYTHONPATH;
        }
        const envProvider = getVariablesProvider(processVariables);
        const vars = await envProvider.getEnvironmentVariables(workspace4PyFile);

        expect(vars).to.not.equal(undefined, 'Variables is is undefiend');
        expect(vars).to.have.property('X1234PYEXTUNITTESTVAR', '1234', 'X1234PYEXTUNITTESTVAR value is invalid');
        expect(vars).to.have.property('PYTHONPATH', '../workspace5', 'PYTHONPATH value is invalid');

        Object.keys(processVariables).forEach(variable => {
            expect(vars).to.have.property(variable, processVariables[variable], 'Value of the variable is incorrect');
        });
    });

    test('Variables from file should take precedence over variables in process', async () => {
        // tslint:disable-next-line:no-invalid-template-strings
        await updateSetting('envFile', '${workspaceRoot}/.env', workspace4PyFile, ConfigurationTarget.WorkspaceFolder);
        const processVariables = { ...process.env };
        if (processVariables.PYTHONPATH) {
            delete processVariables.PYTHONPATH;
        }
        processVariables.X1234PYEXTUNITTESTVAR = 'abcd';
        processVariables.ABCD = 'abcd';
        const envProvider = getVariablesProvider(processVariables);
        const vars = await envProvider.getEnvironmentVariables(workspace4PyFile);

        expect(vars).to.not.equal(undefined, 'Variables is is undefiend');
        expect(vars).to.have.property('X1234PYEXTUNITTESTVAR', '1234', 'X1234PYEXTUNITTESTVAR value is invalid');
        expect(vars).to.have.property('ABCD', 'abcd', 'ABCD value is invalid');
        expect(vars).to.have.property('PYTHONPATH', '../workspace5', 'PYTHONPATH value is invalid');
    });

    test('PYTHONPATH from process variables should be merged with that in env file', async () => {
        // tslint:disable-next-line:no-invalid-template-strings
        await updateSetting('envFile', '${workspaceRoot}/.env', workspace4PyFile, ConfigurationTarget.WorkspaceFolder);
        const processVariables = { ...process.env };
        processVariables.PYTHONPATH = '/usr/one/TWO';
        const envProvider = getVariablesProvider(processVariables);
        const vars = await envProvider.getEnvironmentVariables(workspace4PyFile);

        const expectedPythonPath = `../workspace5${path.delimiter}${processVariables.PYTHONPATH}`;
        expect(vars).to.not.equal(undefined, 'Variables is is undefiend');
        expect(vars).to.have.property('X1234PYEXTUNITTESTVAR', '1234', 'X1234PYEXTUNITTESTVAR value is invalid');
        expect(vars).to.have.property('PYTHONPATH', expectedPythonPath, 'PYTHONPATH value is invalid');
    });

    test('PATH from process variables should be included in in variables returned (mock variables)', async () => {
        // tslint:disable-next-line:no-invalid-template-strings
        await updateSetting('envFile', '${workspaceRoot}/.env', workspace4PyFile, ConfigurationTarget.WorkspaceFolder);
        const processVariables = { ...process.env };
        processVariables.PYTHONPATH = '/usr/one/TWO';
        processVariables[pathVariableName] = '/usr/one/THREE';
        const envProvider = getVariablesProvider(processVariables);
        const vars = await envProvider.getEnvironmentVariables(workspace4PyFile);

        const expectedPythonPath = `../workspace5${path.delimiter}${processVariables.PYTHONPATH}`;
        expect(vars).to.not.equal(undefined, 'Variables is is undefiend');
        expect(vars).to.have.property('X1234PYEXTUNITTESTVAR', '1234', 'X1234PYEXTUNITTESTVAR value is invalid');
        expect(vars).to.have.property('PYTHONPATH', expectedPythonPath, 'PYTHONPATH value is invalid');
        expect(vars).to.have.property(pathVariableName, processVariables[pathVariableName], 'PATH value is invalid');
    });

    test('PATH from process variables should be included in in variables returned', async () => {
        // tslint:disable-next-line:no-invalid-template-strings
        await updateSetting('envFile', '${workspaceRoot}/.env', workspace4PyFile, ConfigurationTarget.WorkspaceFolder);
        const processVariables = { ...process.env };
        processVariables.PYTHONPATH = '/usr/one/TWO';
        const envProvider = getVariablesProvider(processVariables);
        const vars = await envProvider.getEnvironmentVariables(workspace4PyFile);

        const expectedPythonPath = `../workspace5${path.delimiter}${processVariables.PYTHONPATH}`;
        expect(vars).to.not.equal(undefined, 'Variables is is undefiend');
        expect(vars).to.have.property('X1234PYEXTUNITTESTVAR', '1234', 'X1234PYEXTUNITTESTVAR value is invalid');
        expect(vars).to.have.property('PYTHONPATH', expectedPythonPath, 'PYTHONPATH value is invalid');
        expect(vars).to.have.property(pathVariableName, processVariables[pathVariableName], 'PATH value is invalid');
    });

    test('PYTHONPATH and PATH from process variables should be merged with that in env file', async () => {
        // tslint:disable-next-line:no-invalid-template-strings
        await updateSetting('envFile', '${workspaceRoot}/.env5', workspace4PyFile, ConfigurationTarget.WorkspaceFolder);
        const processVariables = { ...process.env };
        processVariables.PYTHONPATH = '/usr/one/TWO';
        processVariables[pathVariableName] = '/usr/one/THREE';
        const envProvider = getVariablesProvider(processVariables);
        const vars = await envProvider.getEnvironmentVariables(workspace4PyFile);

        const expectedPythonPath = `/usr/one/three:/usr/one/four${path.delimiter}${processVariables.PYTHONPATH}`;
        const expectedPath = `/usr/x:/usr/y${path.delimiter}${processVariables[pathVariableName]}`;
        expect(vars).to.not.equal(undefined, 'Variables is is undefiend');
        expect(vars).to.have.property('X', '1', 'X value is invalid');
        expect(vars).to.have.property('Y', '2', 'Y value is invalid');
        expect(vars).to.have.property('PYTHONPATH', expectedPythonPath, 'PYTHONPATH value is invalid');
        expect(vars).to.have.property(pathVariableName, expectedPath, 'PATH value is invalid');
    });

    test('PATH and PYTHONPATH from env file should be returned as is', async () => {
        // tslint:disable-next-line:no-invalid-template-strings
        await updateSetting('envFile', '${workspaceRoot}/.env5', workspace4PyFile, ConfigurationTarget.WorkspaceFolder);
        const processVariables = { ...process.env };
        if (processVariables.PYTHONPATH) {
            delete processVariables.PYTHONPATH;
        }
        if (processVariables[pathVariableName]) {
            delete processVariables[pathVariableName];
        }
        const envProvider = getVariablesProvider(processVariables);
        const vars = await envProvider.getEnvironmentVariables(workspace4PyFile);

        const expectedPythonPath = '/usr/one/three:/usr/one/four';
        const expectedPath = '/usr/x:/usr/y';
        expect(vars).to.not.equal(undefined, 'Variables is is undefiend');
        expect(vars).to.have.property('X', '1', 'X value is invalid');
        expect(vars).to.have.property('Y', '2', 'Y value is invalid');
        expect(vars).to.have.property('PYTHONPATH', expectedPythonPath, 'PYTHONPATH value is invalid');
        expect(vars).to.have.property(pathVariableName, expectedPath, 'PATH value is invalid');
    });

    test('PYTHONPATH and PATH from process variables should be included in variables returned', async () => {
        // tslint:disable-next-line:no-invalid-template-strings
        await updateSetting('envFile', '${workspaceRoot}/.env2', workspace4PyFile, ConfigurationTarget.WorkspaceFolder);
        const processVariables = { ...process.env };
        processVariables.PYTHONPATH = '/usr/one/TWO';
        processVariables[pathVariableName] = '/usr/one/THREE';
        const envProvider = getVariablesProvider(processVariables);
        const vars = await envProvider.getEnvironmentVariables(workspace4PyFile);

        expect(vars).to.not.equal(undefined, 'Variables is is undefiend');
        expect(vars).to.have.property('X12345PYEXTUNITTESTVAR', '12345', 'X12345PYEXTUNITTESTVAR value is invalid');
        expect(vars).to.have.property('PYTHONPATH', processVariables.PYTHONPATH, 'PYTHONPATH value is invalid');
        expect(vars).to.have.property(pathVariableName, processVariables[pathVariableName], 'PATH value is invalid');
    });

    test('PYTHONPATH should not exist in variables returned', async () => {
        // tslint:disable-next-line:no-invalid-template-strings
        await updateSetting('envFile', '${workspaceRoot}/.env2', workspace4PyFile, ConfigurationTarget.WorkspaceFolder);
        const processVariables = { ...process.env };
        if (processVariables.PYTHONPATH) {
            delete processVariables.PYTHONPATH;
        }
        processVariables[pathVariableName] = '/usr/one/THREE';
        const envProvider = getVariablesProvider(processVariables);
        const vars = await envProvider.getEnvironmentVariables(workspace4PyFile);

        expect(vars).to.not.equal(undefined, 'Variables is is undefiend');
        expect(vars).to.have.property('X12345PYEXTUNITTESTVAR', '12345', 'X12345PYEXTUNITTESTVAR value is invalid');
        expect(vars).to.not.have.property('PYTHONPATH');
        expect(vars).to.have.property(pathVariableName, processVariables[pathVariableName], 'PATH value is invalid');
    });

    test('Custom variables should not be merged with process environment varaibles', async () => {
        const randomEnvVariable = `UNIT_TEST_PYTHON_EXT_RANDOM_VARIABLE_${new Date().getSeconds()}`;
        const processVariables = { ...process.env };
        processVariables[randomEnvVariable] = '1234';
        if (processVariables.PYTHONPATH) {
            delete processVariables.PYTHONPATH;
        }
        // tslint:disable-next-line:no-invalid-template-strings
        await updateSetting('envFile', '${workspaceRoot}/.env', workspace4PyFile, ConfigurationTarget.WorkspaceFolder);
        const envProvider = getVariablesProvider(processVariables);
        const vars = await envProvider.getEnvironmentVariables(workspace4PyFile);

        expect(vars).to.not.equal(undefined, 'Variables is is undefiend');
        expect(vars).to.have.property('X1234PYEXTUNITTESTVAR', '1234', 'X1234PYEXTUNITTESTVAR value is invalid');
        expect(vars).to.have.property('PYTHONPATH', '../workspace5', 'PYTHONPATH value is invalid');
        expect(vars).to.not.to.have.property(randomEnvVariable, undefined, 'Yikes process variable has leaked');
    });

    test('Custom variables should be merged with process environment varaibles', async () => {
        const randomEnvVariable = `UNIT_TEST_PYTHON_EXT_RANDOM_VARIABLE_${new Date().getSeconds()}`;
        const processVariables = { ...process.env };
        processVariables[randomEnvVariable] = '1234';
        if (processVariables.PYTHONPATH) {
            delete processVariables.PYTHONPATH;
        }
        // tslint:disable-next-line:no-invalid-template-strings
        await updateSetting('envFile', '${workspaceRoot}/.env', workspace4PyFile, ConfigurationTarget.WorkspaceFolder);
        const envProvider = getVariablesProvider(processVariables);
        const vars = await envProvider.getEnvironmentVariables(workspace4PyFile);

        expect(vars).to.not.equal(undefined, 'Variables is is undefiend');
        expect(vars).to.have.property('X1234PYEXTUNITTESTVAR', '1234', 'X1234PYEXTUNITTESTVAR value is invalid');
        expect(vars).to.have.property('PYTHONPATH', '../workspace5', 'PYTHONPATH value is invalid');
        expect(vars).to.have.property(randomEnvVariable, '1234', 'Yikes process variable has leaked');
    });

    test('Custom variables will be refreshed when settings points to a different env file', async () => {
        // tslint:disable-next-line:no-invalid-template-strings
        await updateSetting('envFile', '${workspaceRoot}/.env', workspace4PyFile, ConfigurationTarget.WorkspaceFolder);
        const processVariables = { ...process.env };
        if (processVariables.PYTHONPATH) {
            delete processVariables.PYTHONPATH;
        }
        const envProvider = getVariablesProvider(processVariables);
        const vars = await envProvider.getEnvironmentVariables(workspace4PyFile);
        expect(vars).to.not.equal(undefined, 'Variables is is undefiend');
        expect(vars).to.have.property('X1234PYEXTUNITTESTVAR', '1234', 'X1234PYEXTUNITTESTVAR value is invalid');
        expect(vars).to.have.property('PYTHONPATH', '../workspace5', 'PYTHONPATH value is invalid');

        const settings = workspace.getConfiguration('python', workspace4PyFile);
        // tslint:disable-next-line:no-invalid-template-strings
        await settings.update('envFile', '${workspaceRoot}/.env2', ConfigurationTarget.WorkspaceFolder);

        // Wait for settings to get refreshed.
        await new Promise(resolve => setTimeout(resolve, 5000));

        const newVars = await envProvider.getEnvironmentVariables(workspace4PyFile);
        expect(newVars).to.not.equal(undefined, 'Variables is is undefiend');
        expect(newVars).to.have.property('X12345PYEXTUNITTESTVAR', '12345', 'X12345PYEXTUNITTESTVAR value is invalid');
        expect(newVars).to.not.to.have.property('PYTHONPATH', '../workspace5', 'PYTHONPATH value is invalid');
    });

    test('Custom variables will be refreshed when .env file is created, modified and deleted', async function () {
        // tslint:disable-next-line:no-invalid-this
        this.timeout(20000);
        const env3 = path.join(workspace4Path.fsPath, '.env3');
        const fileExists = await fs.pathExists(env3);
        if (fileExists) {
            await fs.remove(env3);
        }
        // tslint:disable-next-line:no-invalid-template-strings
        await updateSetting('envFile', '${workspaceRoot}/.env3', workspace4PyFile, ConfigurationTarget.WorkspaceFolder);
        const processVariables = { ...process.env };
        if (processVariables.PYTHONPATH) {
            delete processVariables.PYTHONPATH;
        }
        const envProvider = getVariablesProvider(processVariables);
        const vars = envProvider.getEnvironmentVariables(workspace4PyFile);
        await expect(vars).to.eventually.not.equal(undefined, 'Variables is is undefiend');

        // Create env3.
        const contents = fs.readFileSync(path.join(workspace4Path.fsPath, '.env2'));
        fs.writeFileSync(env3, contents);

        // Wait for settings to get refreshed.
        await new Promise(resolve => setTimeout(resolve, 5000));

        const newVars = await envProvider.getEnvironmentVariables(workspace4PyFile);
        expect(newVars).to.not.equal(undefined, 'Variables is is undefiend after creating');
        expect(newVars).to.have.property('X12345PYEXTUNITTESTVAR', '12345', 'X12345PYEXTUNITTESTVAR value is invalid after creating');
        expect(newVars).to.not.to.have.property('PYTHONPATH', '../workspace5', 'PYTHONPATH value is invalid after creating');

        // Modify env3.
        fs.writeFileSync(env3, `${contents}${EOL}X123456PYEXTUNITTESTVAR=123456`);

        // Wait for settings to get refreshed.
        await new Promise(resolve => setTimeout(resolve, 5000));

        const updatedVars = await envProvider.getEnvironmentVariables(workspace4PyFile);
        expect(updatedVars).to.not.equal(undefined, 'Variables is is undefiend after modifying');
        expect(updatedVars).to.have.property('X12345PYEXTUNITTESTVAR', '12345', 'X12345PYEXTUNITTESTVAR value is invalid after modifying');
        expect(updatedVars).to.not.to.have.property('PYTHONPATH', '../workspace5', 'PYTHONPATH value is invalid after modifying');
        expect(updatedVars).to.have.property('X123456PYEXTUNITTESTVAR', '123456', 'X123456PYEXTUNITTESTVAR value is invalid after modifying');

        // Now remove env3.
        await fs.remove(env3);

        // Wait for settings to get refreshed.
        await new Promise(resolve => setTimeout(resolve, 5000));

        const varsAfterDeleting = await envProvider.getEnvironmentVariables(workspace4PyFile);
        expect(varsAfterDeleting).to.not.equal(undefined, 'Variables is undefiend after deleting');
    });

    test('Change event will be raised when when .env file is created, modified and deleted', async function () {
        // tslint:disable-next-line:no-invalid-this
        this.timeout(20000);
        const env3 = path.join(workspace4Path.fsPath, '.env3');
        const fileExists = await fs.pathExists(env3);
        if (fileExists) {
            await fs.remove(env3);
        }
        // tslint:disable-next-line:no-invalid-template-strings
        await updateSetting('envFile', '${workspaceRoot}/.env3', workspace4PyFile, ConfigurationTarget.WorkspaceFolder);
        const processVariables = { ...process.env };
        if (processVariables.PYTHONPATH) {
            delete processVariables.PYTHONPATH;
        }
        const envProvider = getVariablesProvider(processVariables);
        let eventRaisedPromise = createDeferred<boolean>();
        envProvider.onDidEnvironmentVariablesChange(() => eventRaisedPromise.resolve(true));
        const vars = envProvider.getEnvironmentVariables(workspace4PyFile);
        await expect(vars).to.eventually.not.equal(undefined, 'Variables is is undefiend');

        // Create env3.
        const contents = fs.readFileSync(path.join(workspace4Path.fsPath, '.env2'));
        fs.writeFileSync(env3, contents);

        // Wait for settings to get refreshed.
        await new Promise(resolve => setTimeout(resolve, 5000));

        let eventRaised = await eventRaisedPromise.promise;
        expect(eventRaised).to.equal(true, 'Create notification not raised');

        // Modify env3.
        eventRaisedPromise = createDeferred<boolean>();
        fs.writeFileSync(env3, `${contents}${EOL}X123456PYEXTUNITTESTVAR=123456`);

        // Wait for settings to get refreshed.
        await new Promise(resolve => setTimeout(resolve, 5000));

        eventRaised = await eventRaisedPromise.promise;
        expect(eventRaised).to.equal(true, 'Change notification not raised');

        // Now remove env3.
        eventRaisedPromise = createDeferred<boolean>();
        await fs.remove(env3);

        // Wait for settings to get refreshed.
        await new Promise(resolve => setTimeout(resolve, 5000));

        eventRaised = await eventRaisedPromise.promise;
        expect(eventRaised).to.equal(true, 'Delete notification not raised');
    });
});
