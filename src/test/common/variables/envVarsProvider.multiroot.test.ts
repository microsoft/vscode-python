// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as fs from 'fs-extra';
import { Container } from 'inversify';
import { EOL } from 'os';
import * as path from 'path';
import { ConfigurationTarget, Disposable, Uri, workspace } from 'vscode';
import { IS_WINDOWS } from '../../../client/common/configSettings';
import { PathUtils } from '../../../client/common/platform/pathUtils';
import { registerTypes as processRegisterTypes } from '../../../client/common/process/serviceRegistry';
import { IDiposableRegistry, IPathUtils } from '../../../client/common/types';
import { IsWindows } from '../../../client/common/types';
import { registerTypes as variablesRegisterTypes } from '../../../client/common/variables/serviceRegistry';
import { IEnvironmentVariablesProvider } from '../../../client/common/variables/types';
import { ServiceManager } from '../../../client/ioc/serviceManager';
import { clearPythonPathInWorkspaceFolder, updateSetting } from '../../common';
import { closeActiveWindows, initialize, initializeTest, IS_MULTI_ROOT_TEST } from '../../initialize';

use(chaiAsPromised);

const multirootPath = path.join(__dirname, '..', '..', '..', '..', 'src', 'testMultiRootWkspc');
const workspace4Path = Uri.file(path.join(multirootPath, 'workspace4'));
const workspace4PyFile = Uri.file(path.join(workspace4Path.fsPath, 'one.py'));

// tslint:disable-next-line:max-func-body-length
suite('Multiroot Environment Variables Provider', () => {
    let cont: Container;
    let serviceManager: ServiceManager;
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
        cont = new Container();
        serviceManager = new ServiceManager(cont);
        serviceManager.addSingletonInstance<Disposable[]>(IDiposableRegistry, []);
        serviceManager.addSingletonInstance<boolean>(IsWindows, IS_WINDOWS);
        serviceManager.addSingleton<IPathUtils>(IPathUtils, PathUtils);
        processRegisterTypes(serviceManager);
        variablesRegisterTypes(serviceManager);
        return initializeTest();
    });
    suiteTeardown(closeActiveWindows);
    teardown(async () => {
        cont.unbindAll();
        cont.unload();
        await closeActiveWindows();
        await clearPythonPathInWorkspaceFolder(workspace4Path);
        await updateSetting('envFile', undefined, workspace4PyFile, ConfigurationTarget.WorkspaceFolder);
        await initializeTest();
    });

    test('Custom variables should be undefined without an env file', async () => {
        await updateSetting('envFile', 'someInvalidFile.env', workspace4PyFile, ConfigurationTarget.WorkspaceFolder);
        const envProvider = serviceManager.get<IEnvironmentVariablesProvider>(IEnvironmentVariablesProvider);
        const vars = envProvider.getEnvironmentVariables(false, workspace4PyFile);
        await expect(vars).to.eventually.equal(undefined, 'Variables is not undefiend');
    });

    test('Custom variables should be parsed from env file', async () => {
        // tslint:disable-next-line:no-invalid-template-strings
        await updateSetting('envFile', '${workspaceRoot}/.env', workspace4PyFile, ConfigurationTarget.WorkspaceFolder);
        const envProvider = serviceManager.get<IEnvironmentVariablesProvider>(IEnvironmentVariablesProvider);
        const vars = await envProvider.getEnvironmentVariables(false, workspace4PyFile);

        expect(vars).to.not.equal(undefined, 'Variables is is undefiend');
        expect(vars).to.to.have.property('X1234PYEXTUNITTESTVAR', '1234', 'X1234PYEXTUNITTESTVAR value is invalid');
        expect(vars).to.to.have.property('PYTHONPATH', '../workspace5', 'PYTHONPATH value is invalid');
    });

    test('Custom variables should not be merged with process environment varaibles', async () => {
        const randomEnvVariable = `UNIT_TEST_PYTHON_EXT_RANDOM_VARIABLE_${new Date().getSeconds()}`;
        process.env[randomEnvVariable] = '1234';
        // tslint:disable-next-line:no-invalid-template-strings
        await updateSetting('envFile', '${workspaceRoot}/.env', workspace4PyFile, ConfigurationTarget.WorkspaceFolder);
        const envProvider = serviceManager.get<IEnvironmentVariablesProvider>(IEnvironmentVariablesProvider);
        const vars = await envProvider.getEnvironmentVariables(false, workspace4PyFile);

        expect(vars).to.not.equal(undefined, 'Variables is is undefiend');
        expect(vars).to.to.have.property('X1234PYEXTUNITTESTVAR', '1234', 'X1234PYEXTUNITTESTVAR value is invalid');
        expect(vars).to.to.have.property('PYTHONPATH', '../workspace5', 'PYTHONPATH value is invalid');
        expect(vars).to.not.to.have.property(randomEnvVariable, undefined, 'Yikes process variable has leaked');
    });

    test('Custom variables should be merged with process environment varaibles', async () => {
        const randomEnvVariable = `UNIT_TEST_PYTHON_EXT_RANDOM_VARIABLE_${new Date().getSeconds()}`;
        process.env[randomEnvVariable] = '1234';
        // tslint:disable-next-line:no-invalid-template-strings
        await updateSetting('envFile', '${workspaceRoot}/.env', workspace4PyFile, ConfigurationTarget.WorkspaceFolder);
        const envProvider = serviceManager.get<IEnvironmentVariablesProvider>(IEnvironmentVariablesProvider);
        const vars = await envProvider.getEnvironmentVariables(true, workspace4PyFile);

        expect(vars).to.not.equal(undefined, 'Variables is is undefiend');
        expect(vars).to.to.have.property('X1234PYEXTUNITTESTVAR', '1234', 'X1234PYEXTUNITTESTVAR value is invalid');
        expect(vars).to.to.have.property('PYTHONPATH', '../workspace5', 'PYTHONPATH value is invalid');
        expect(vars).to.to.have.property(randomEnvVariable, '1234', 'Yikes process variable has leaked');
    });

    test('Custom variables will be refreshed when settings points to a different env file', async () => {
        // tslint:disable-next-line:no-invalid-template-strings
        await updateSetting('envFile', '${workspaceRoot}/.env', workspace4PyFile, ConfigurationTarget.WorkspaceFolder);
        const envProvider = serviceManager.get<IEnvironmentVariablesProvider>(IEnvironmentVariablesProvider);
        const vars = await envProvider.getEnvironmentVariables(false, workspace4PyFile);
        expect(vars).to.not.equal(undefined, 'Variables is is undefiend');
        expect(vars).to.to.have.property('X1234PYEXTUNITTESTVAR', '1234', 'X1234PYEXTUNITTESTVAR value is invalid');
        expect(vars).to.to.have.property('PYTHONPATH', '../workspace5', 'PYTHONPATH value is invalid');

        const settings = workspace.getConfiguration('python', workspace4PyFile);
        // tslint:disable-next-line:no-invalid-template-strings
        await settings.update('envFile', '${workspaceRoot}/.env2', ConfigurationTarget.WorkspaceFolder);

        // Wait for settings to get refreshed.
        await new Promise(resolve => setTimeout(resolve, 5000));

        const newVars = await envProvider.getEnvironmentVariables(false, workspace4PyFile);
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
        const envProvider = serviceManager.get<IEnvironmentVariablesProvider>(IEnvironmentVariablesProvider);
        const vars = envProvider.getEnvironmentVariables(false, workspace4PyFile);
        await expect(vars).to.eventually.equal(undefined, 'Variables is is undefiend');

        // Create env3.
        const contents = fs.readFileSync(path.join(workspace4Path.fsPath, '.env2'));
        fs.writeFileSync(env3, contents);

        // Wait for settings to get refreshed.
        await new Promise(resolve => setTimeout(resolve, 5000));

        const newVars = await envProvider.getEnvironmentVariables(false, workspace4PyFile);
        expect(newVars).to.not.equal(undefined, 'Variables is is undefiend after creating');
        expect(newVars).to.to.have.property('X12345PYEXTUNITTESTVAR', '12345', 'X12345PYEXTUNITTESTVAR value is invalid after creating');
        expect(newVars).to.not.to.have.property('PYTHONPATH', '../workspace5', 'PYTHONPATH value is invalid after creating');

        // Modify env3.
        fs.writeFileSync(env3, `${contents}${EOL}X123456PYEXTUNITTESTVAR=123456`);

        // Wait for settings to get refreshed.
        await new Promise(resolve => setTimeout(resolve, 5000));

        const updatedVars = await envProvider.getEnvironmentVariables(false, workspace4PyFile);
        expect(updatedVars).to.not.equal(undefined, 'Variables is is undefiend after modifying');
        expect(updatedVars).to.to.have.property('X12345PYEXTUNITTESTVAR', '12345', 'X12345PYEXTUNITTESTVAR value is invalid after modifying');
        expect(updatedVars).to.not.to.have.property('PYTHONPATH', '../workspace5', 'PYTHONPATH value is invalid after modifying');
        expect(updatedVars).to.to.have.property('X123456PYEXTUNITTESTVAR', '123456', 'X123456PYEXTUNITTESTVAR value is invalid after modifying');

        // Now remove env3.
        await fs.remove(env3);

        // Wait for settings to get refreshed.
        await new Promise(resolve => setTimeout(resolve, 5000));

        const varsAfterDeleting = await envProvider.getEnvironmentVariables(false, workspace4PyFile);
        expect(varsAfterDeleting).to.equal(undefined, 'Variables is not undefiend after deleting');
    });
});
