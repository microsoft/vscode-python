// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as path from 'path';
import { anything, instance, mock, when } from 'ts-mockito';
import { ConfigurationTarget, Disposable, Uri, workspace } from 'vscode';
import { WorkspaceService } from '../../../client/common/application/workspace';
import { ConfigurationService } from '../../../client/common/configuration/service';
import {
    IS_WINDOWS,
    NON_WINDOWS_PATH_VARIABLE_NAME,
    WINDOWS_PATH_VARIABLE_NAME
} from '../../../client/common/platform/constants';
import { PlatformService } from '../../../client/common/platform/platformService';
import { IFileSystem } from '../../../client/common/platform/types';
import { IDisposableRegistry, IPathUtils } from '../../../client/common/types';
import { clearCache } from '../../../client/common/utils/cacheUtils';
import { EnvironmentVariablesService } from '../../../client/common/variables/environment';
import { EnvironmentVariablesProvider } from '../../../client/common/variables/environmentVariablesProvider';
import { EnvironmentVariables } from '../../../client/common/variables/types';
import { EnvironmentActivationService } from '../../../client/interpreter/activation/service';
import { IEnvironmentActivationService } from '../../../client/interpreter/activation/types';
import { IInterpreterAutoSelectionService } from '../../../client/interpreter/autoSelection/types';
import { clearPythonPathInWorkspaceFolder, isOs, OSType, updateSetting } from '../../common';
import { closeActiveWindows, initialize, initializeTest, IS_MULTI_ROOT_TEST } from '../../initialize';
import { MockAutoSelectionService } from '../../mocks/autoSelector';
import { MockProcess } from '../../mocks/process';
import { UnitTestIocContainer } from '../../testing/serviceRegistry';

use(chaiAsPromised);

const multirootPath = path.join(__dirname, '..', '..', '..', '..', 'src', 'testMultiRootWkspc');
const workspace4Path = Uri.file(path.join(multirootPath, 'workspace4'));
const workspace4PyFile = Uri.file(path.join(workspace4Path.fsPath, 'one.py'));

// tslint:disable-next-line:max-func-body-length
suite('Multiroot Environment Variables Provider', () => {
    let ioc: UnitTestIocContainer;
    const pathVariableName = IS_WINDOWS ? WINDOWS_PATH_VARIABLE_NAME : NON_WINDOWS_PATH_VARIABLE_NAME;
    suiteSetup(async function() {
        if (!IS_MULTI_ROOT_TEST) {
            // tslint:disable-next-line:no-invalid-this
            return this.skip();
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
        const mockEnvironmentActivationService = mock(EnvironmentActivationService);
        when(mockEnvironmentActivationService.getActivatedEnvironmentVariables(anything())).thenResolve();
        when(mockEnvironmentActivationService.getActivatedEnvironmentVariables(anything(), anything())).thenResolve();
        when(
            mockEnvironmentActivationService.getActivatedEnvironmentVariables(anything(), anything(), anything())
        ).thenResolve();
        ioc.serviceManager.rebindInstance<IEnvironmentActivationService>(
            IEnvironmentActivationService,
            instance(mockEnvironmentActivationService)
        );
        clearCache();
        return initializeTest();
    });
    suiteTeardown(closeActiveWindows);
    teardown(async () => {
        await ioc.dispose();
        await closeActiveWindows();
        await clearPythonPathInWorkspaceFolder(workspace4Path);
        await updateSetting('envFile', undefined, workspace4PyFile, ConfigurationTarget.WorkspaceFolder);
        await initializeTest();
        clearCache();
    });

    function getVariablesProvider(mockVariables: EnvironmentVariables = { ...process.env }) {
        const pathUtils = ioc.serviceContainer.get<IPathUtils>(IPathUtils);
        const fs = ioc.serviceContainer.get<IFileSystem>(IFileSystem);
        const mockProcess = new MockProcess(mockVariables);
        const variablesService = new EnvironmentVariablesService(pathUtils, fs);
        const disposables = ioc.serviceContainer.get<Disposable[]>(IDisposableRegistry);
        ioc.serviceManager.addSingletonInstance(IInterpreterAutoSelectionService, new MockAutoSelectionService());
        const cfgService = new ConfigurationService(ioc.serviceContainer);
        const workspaceService = new WorkspaceService();
        return new EnvironmentVariablesProvider(
            variablesService,
            disposables,
            new PlatformService(),
            workspaceService,
            cfgService,
            mockProcess,
            ioc.serviceContainer
        );
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
            expect(vars).to.have.property(variable);
            // On CI, it was seen that processVariable[variable] can contain spaces at the end, which causes tests to fail. So trim the strings before comparing.
            expect(vars[variable]?.trim()).to.equal(
                processVariables[variable]?.trim(),
                'Value of the variable is incorrect'
            );
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

    test('PATH from process variables should be included in in variables returned', async function() {
        // this test is flaky on windows (likely the value of the path property
        // has incorrect path separator chars). Tracked by GH #4756
        if (isOs(OSType.Windows)) {
            // tslint:disable-next-line:no-invalid-this
            return this.skip();
        }
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
});
