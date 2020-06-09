// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { ApplicationShell } from '../../../../client/common/application/applicationShell';
import { IApplicationShell } from '../../../../client/common/application/types';
import { ProductInstaller } from '../../../../client/common/installer/productInstaller';
import { IInstaller, InstallerResponse, Product } from '../../../../client/common/types';
import { DataScience } from '../../../../client/common/utils/localize';
import { Architecture } from '../../../../client/common/utils/platform';
import {
    InterpreterJupyterKernelSpecCommand,
    JupyterCommandFactory
} from '../../../../client/datascience/jupyter/interpreter/jupyterCommand';
import {
    JupyterInterpreterDependencyResponse,
    JupyterInterpreterDependencyService
} from '../../../../client/datascience/jupyter/interpreter/jupyterInterpreterDependencyService';
import { IJupyterCommand, IJupyterCommandFactory } from '../../../../client/datascience/types';
import { InterpreterType, PythonInterpreter } from '../../../../client/pythonEnvironments/info';

// tslint:disable: max-func-body-length no-any

suite('Data Science - Jupyter Interpreter Configuration', () => {
    let configuration: JupyterInterpreterDependencyService;
    let appShell: IApplicationShell;
    let installer: IInstaller;
    let commandFactory: IJupyterCommandFactory;
    let command: IJupyterCommand;
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
        commandFactory = mock(JupyterCommandFactory);
        command = mock(InterpreterJupyterKernelSpecCommand);
        instance(commandFactory as any).then = undefined;
        instance(command as any).then = undefined;
        when(
            commandFactory.createInterpreterCommand(anything(), anything(), anything(), anything(), anything())
        ).thenReturn(instance(command));
        when(command.exec(anything(), anything())).thenResolve({ stdout: '' });

        configuration = new JupyterInterpreterDependencyService(
            instance(appShell),
            instance(installer),
            instance(commandFactory)
        );
    });
    test('Return ok if all dependencies are installed', async () => {
        when(installer.isInstalled(Product.jupyter, pythonInterpreter)).thenResolve(true);
        when(installer.isInstalled(Product.notebook, pythonInterpreter)).thenResolve(true);

        const response = await configuration.installMissingDependencies(pythonInterpreter);

        assert.equal(response, JupyterInterpreterDependencyResponse.ok);
    });
    async function testPromptIfModuleNotInstalled(
        jupyterInstalled: boolean,
        notebookInstalled: boolean
    ): Promise<void> {
        when(installer.isInstalled(Product.jupyter, pythonInterpreter)).thenResolve(jupyterInstalled);
        when(installer.isInstalled(Product.notebook, pythonInterpreter)).thenResolve(notebookInstalled);
        when(appShell.showErrorMessage(anything(), anything(), anything(), anything())).thenResolve();

        const response = await configuration.installMissingDependencies(pythonInterpreter);

        verify(
            appShell.showErrorMessage(
                anything(),
                DataScience.jupyterInstall(),
                DataScience.selectDifferentJupyterInterpreter(),
                DataScience.pythonInteractiveHelpLink()
            )
        ).once();
        assert.equal(response, JupyterInterpreterDependencyResponse.cancel);
    }
    test('Prompt to install if Jupyter is not installed', async () => testPromptIfModuleNotInstalled(false, true));
    test('Prompt to install if notebook is not installed', async () => testPromptIfModuleNotInstalled(true, false));
    test('Prompt to install if jupyter & notebook is not installed', async () =>
        testPromptIfModuleNotInstalled(false, false));
    test('Reinstall Jupyter if jupyter and notebook are installed but kernelspec is not found', async () => {
        when(installer.isInstalled(Product.jupyter, pythonInterpreter)).thenResolve(true);
        when(installer.isInstalled(Product.notebook, pythonInterpreter)).thenResolve(true);
        when(appShell.showErrorMessage(anything(), anything(), anything(), anything())).thenResolve(
            // tslint:disable-next-line: no-any
            DataScience.jupyterInstall() as any
        );
        when(command.exec(anything(), anything())).thenReject(new Error('Not found'));
        when(installer.install(anything(), anything(), anything())).thenResolve(InstallerResponse.Installed);

        const response = await configuration.installMissingDependencies(pythonInterpreter);

        // Jupyter must be installed & not kernelspec or anything else.
        verify(installer.install(Product.jupyter, anything(), anything())).once();
        verify(installer.install(anything(), anything(), anything())).once();
        verify(
            appShell.showErrorMessage(
                anything(),
                DataScience.jupyterInstall(),
                DataScience.selectDifferentJupyterInterpreter(),
                anything()
            )
        ).once();
        assert.equal(response, JupyterInterpreterDependencyResponse.cancel);
    });

    async function testInstallationOfJupyter(
        installerResponse: InstallerResponse,
        expectedConfigurationReponse: JupyterInterpreterDependencyResponse
    ): Promise<void> {
        when(installer.isInstalled(Product.jupyter, pythonInterpreter)).thenResolve(false);
        when(installer.isInstalled(Product.notebook, pythonInterpreter)).thenResolve(true);
        when(appShell.showErrorMessage(anything(), anything(), anything(), anything())).thenResolve(
            // tslint:disable-next-line: no-any
            DataScience.jupyterInstall() as any
        );
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
        when(appShell.showErrorMessage(anything(), anything(), anything(), anything())).thenResolve(
            // tslint:disable-next-line: no-any
            DataScience.jupyterInstall() as any
        );
        when(installer.install(Product.jupyter, anything(), anything())).thenResolve(jupyterInstallerResponse);
        when(installer.install(Product.notebook, anything(), anything())).thenResolve(notebookInstallationResponse);

        const response = await configuration.installMissingDependencies(pythonInterpreter);

        verify(installer.install(Product.jupyter, pythonInterpreter, anything())).once();
        verify(installer.install(Product.notebook, pythonInterpreter, anything())).once();
        assert.equal(response, expectedConfigurationReponse);
    }
    test('Install Jupyter and return ok if installed successfully', async () =>
        testInstallationOfJupyter(InstallerResponse.Installed, JupyterInterpreterDependencyResponse.ok));
    test('Install Jupyter & notebook and return ok if both are installed successfully', async () =>
        testInstallationOfJupyterAndNotebook(
            InstallerResponse.Installed,
            InstallerResponse.Installed,
            JupyterInterpreterDependencyResponse.ok
        ));
    test('Install Jupyter & notebook and return cancel if notebook is not installed', async () =>
        testInstallationOfJupyterAndNotebook(
            InstallerResponse.Installed,
            InstallerResponse.Ignore,
            JupyterInterpreterDependencyResponse.cancel
        ));
    test('Install Jupyter and return cancel if installation is disabled', async () =>
        testInstallationOfJupyter(InstallerResponse.Disabled, JupyterInterpreterDependencyResponse.cancel));
    test('Install Jupyter and return cancel if installation is ignored', async () =>
        testInstallationOfJupyter(InstallerResponse.Ignore, JupyterInterpreterDependencyResponse.cancel));
});
