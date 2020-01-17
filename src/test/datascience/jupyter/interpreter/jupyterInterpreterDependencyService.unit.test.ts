// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import { anything, deepEqual, instance, mock, verify, when } from 'ts-mockito';
import { ApplicationShell } from '../../../../client/common/application/applicationShell';
import { IApplicationShell } from '../../../../client/common/application/types';
import { ProductInstaller } from '../../../../client/common/installer/productInstaller';
import { PythonExecutionFactory } from '../../../../client/common/process/pythonExecutionFactory';
import { PythonExecutionService } from '../../../../client/common/process/pythonProcess';
import { IPythonExecutionService } from '../../../../client/common/process/types';
import { IInstaller, InstallerResponse, Product } from '../../../../client/common/types';
import { Common, DataScience } from '../../../../client/common/utils/localize';
import { Architecture } from '../../../../client/common/utils/platform';
import { JupyterInterpreterDependencyResponse, JupyterInterpreterDependencyService } from '../../../../client/datascience/jupyter/interpreter/jupyterInterpreterDependencyService';
import { InterpreterType, PythonInterpreter } from '../../../../client/interpreter/contracts';

suite('Data Science - Jupyter Interpreter Configuration', () => {
    let configuration: JupyterInterpreterDependencyService;
    let appShell: IApplicationShell;
    let installer: IInstaller;
    let pythonExecService: IPythonExecutionService;
    const pythonInterpreter: PythonInterpreter = {
        path: '',
        architecture: Architecture.Unknown,
        sysPrefix: '',
        sysVersion: '',
        type: InterpreterType.Unknown
    };
    setup(() => {
        appShell = mock(ApplicationShell);
        installer = mock(ProductInstaller);
        pythonExecService = mock(PythonExecutionService);
        const pythonExecFactory = mock(PythonExecutionFactory);
        when(pythonExecFactory.createActivatedEnvironment(anything())).thenResolve(instance(pythonExecService));
        // tslint:disable-next-line: no-any
        instance(pythonExecService as any).then = undefined;
        when(pythonExecService.execModule('jupyter', deepEqual(['kernelspec', '--version']), anything())).thenResolve({ stdout: '' });

        configuration = new JupyterInterpreterDependencyService(instance(appShell), instance(installer), instance(pythonExecFactory));
    });
    test('Return ok if all dependencies are installed', async () => {
        when(installer.isInstalled(Product.jupyter, pythonInterpreter)).thenResolve(true);
        when(installer.isInstalled(Product.notebook, pythonInterpreter)).thenResolve(true);

        const response = await configuration.installMissingDependencies(pythonInterpreter);

        assert.equal(response, JupyterInterpreterDependencyResponse.ok);
    });
    async function testPromptIfModuleNotInstalled(jupyterInstalled: boolean, notebookInstalled: boolean): Promise<void> {
        when(installer.isInstalled(Product.jupyter, pythonInterpreter)).thenResolve(jupyterInstalled);
        when(installer.isInstalled(Product.notebook, pythonInterpreter)).thenResolve(notebookInstalled);
        when(appShell.showErrorMessage(anything(), anything(), anything(), anything())).thenResolve();

        const response = await configuration.installMissingDependencies(pythonInterpreter);

        verify(appShell.showErrorMessage(anything(), DataScience.jupyterInstall(), DataScience.selectDifferentJupyterInterpreter(), Common.cancel())).once();
        assert.equal(response, JupyterInterpreterDependencyResponse.cancel);
    }
    test('Prompt to install if Jupyter is not installed', async () => testPromptIfModuleNotInstalled(false, true));
    test('Prompt to install if notebook is not installed', async () => testPromptIfModuleNotInstalled(true, false));
    test('Prompt to install if jupyter & notebook is not installed', async () => testPromptIfModuleNotInstalled(false, false));

    async function testInstallationOfJupyter(installerResponse: InstallerResponse, expectedConfigurationReponse: JupyterInterpreterDependencyResponse): Promise<void> {
        when(installer.isInstalled(Product.jupyter, pythonInterpreter)).thenResolve(false);
        when(installer.isInstalled(Product.notebook, pythonInterpreter)).thenResolve(true);
        // tslint:disable-next-line: no-any
        when(appShell.showErrorMessage(anything(), anything(), anything(), anything())).thenResolve(DataScience.jupyterInstall() as any);
        when(installer.install(anything(), anything(), anything())).thenResolve(installerResponse);

        const response = await configuration.installMissingDependencies(pythonInterpreter);

        verify(installer.install(Product.jupyter, pythonInterpreter, anything())).once();
        assert.equal(response, expectedConfigurationReponse);
    }
    async function testInstallationOfJupyterAndNotebook(
        jupyterInstallerResponse: InstallerResponse,
        notebookInstallationResponse: InstallerResponse,
        expectedConfigurationReponse: JupyterInterpreterDependencyResponse
    ): Promise<void> {
        when(installer.isInstalled(Product.jupyter, pythonInterpreter)).thenResolve(false);
        when(installer.isInstalled(Product.notebook, pythonInterpreter)).thenResolve(false);
        // tslint:disable-next-line: no-any
        when(appShell.showErrorMessage(anything(), anything(), anything(), anything())).thenResolve(DataScience.jupyterInstall() as any);
        when(installer.install(Product.jupyter, anything(), anything())).thenResolve(jupyterInstallerResponse);
        when(installer.install(Product.notebook, anything(), anything())).thenResolve(notebookInstallationResponse);

        const response = await configuration.installMissingDependencies(pythonInterpreter);

        verify(installer.install(Product.jupyter, pythonInterpreter, anything())).once();
        verify(installer.install(Product.notebook, pythonInterpreter, anything())).once();
        assert.equal(response, expectedConfigurationReponse);
    }
    test('Install Jupyter and return ok if installed successfully', async () => testInstallationOfJupyter(InstallerResponse.Installed, JupyterInterpreterDependencyResponse.ok));
    test('Install Jupyter & notebook and return ok if both are installed successfully', async () =>
        testInstallationOfJupyterAndNotebook(InstallerResponse.Installed, InstallerResponse.Installed, JupyterInterpreterDependencyResponse.ok));
    test('Install Jupyter & notebook and return cancel if notebook is not installed', async () =>
        testInstallationOfJupyterAndNotebook(InstallerResponse.Installed, InstallerResponse.Ignore, JupyterInterpreterDependencyResponse.cancel));
    test('Install Jupyter and return cancel if installation is disabled', async () =>
        testInstallationOfJupyter(InstallerResponse.Disabled, JupyterInterpreterDependencyResponse.cancel));
    test('Install Jupyter and return cancel if installation is ignored', async () =>
        testInstallationOfJupyter(InstallerResponse.Ignore, JupyterInterpreterDependencyResponse.cancel));
});
