// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { CancellationToken } from 'vscode';
import { IApplicationShell } from '../../../common/application/types';
import { Cancellation, createPromiseFromCancellation } from '../../../common/cancellation';
import { ProductNames } from '../../../common/installer/productNames';
import { IPythonExecutionFactory } from '../../../common/process/types';
import { IInstaller, InstallerResponse, Product } from '../../../common/types';
import { Common, DataScience } from '../../../common/utils/localize';
import { noop } from '../../../common/utils/misc';
import { PythonInterpreter } from '../../../interpreter/contracts';
import { sendTelemetryEvent } from '../../../telemetry';
import { Telemetry } from '../../constants';

export enum JupyterInterpreterConfigurationResponse {
    ok,
    selectAnotherInterpreter,
    cancel
}

/**
 * Responsible for configuration a Python interpreter to run Jupyter.
 * If required modules aren't installed, will prompt user to install them or select another interpreter.
 *
 * @export
 * @class JupyterInterpreterConfigurationService
 */
@injectable()
export class JupyterInterpreterConfigurationService {
    constructor(
        @inject(IApplicationShell) private readonly applicationShell: IApplicationShell,
        @inject(IInstaller) private readonly installer: IInstaller,
        @inject(IPythonExecutionFactory) private readonly pythonExecFactory: IPythonExecutionFactory
    ) {}
    /**
     * Configures the python interpreter to ensure it can run Jupyter server by installing any missing dependencies.
     * If user opts not to isntall they can opt to select another interpreter.
     *
     * @param {PythonInterpreter} interpreter
     * @param {CancellationToken} [token]
     * @returns {Promise<JupyterInterpreterConfigurationResponse>}
     * @memberof JupyterInterpreterConfigurationService
     */
    public async configureInterpreter(interpreter: PythonInterpreter, token?: CancellationToken): Promise<JupyterInterpreterConfigurationResponse> {
        const productsToInstall = await this.getDependenciesNotInstalled(interpreter, token);
        if (Cancellation.isCanceled(token)) {
            return JupyterInterpreterConfigurationResponse.cancel;
        }
        if (productsToInstall.length === 0) {
            return this.checkKernelSpecAvailability(interpreter);
        }

        const names = productsToInstall
            .map(product => ProductNames.get(product))
            .filter(name => !!name)
            .map(name => name as string);
        const message = DataScience.libraryNotInstalled().format(names.join(` ${Common.and} `));

        const selection = await this.applicationShell.showErrorMessage(message, DataScience.jupyterInstall(), DataScience.selectDifferentJupyterInterpreter(), Common.cancel());

        if (Cancellation.isCanceled(token)) {
            return JupyterInterpreterConfigurationResponse.cancel;
        }

        switch (selection) {
            case DataScience.jupyterInstall(): {
                let productToInstall = productsToInstall.shift();
                const cancellatonPromise = createPromiseFromCancellation({ cancelAction: 'resolve', defaultValue: InstallerResponse.Ignore, token });
                while (productToInstall) {
                    const response = await Promise.race([this.installer.install(productToInstall, interpreter), cancellatonPromise]);
                    if (response === InstallerResponse.Installed) {
                        productToInstall = productsToInstall.shift();
                        continue;
                    } else {
                        return JupyterInterpreterConfigurationResponse.cancel;
                    }
                }

                return this.checkKernelSpecAvailability(interpreter);
            }

            case DataScience.selectDifferentJupyterInterpreter(): {
                return JupyterInterpreterConfigurationResponse.selectAnotherInterpreter;
            }

            default:
                return JupyterInterpreterConfigurationResponse.cancel;
        }
    }
    /**
     * Whether all dependencies required to start & use a jupyter server are available in the provided interpreter.
     *
     * @param {PythonInterpreter} interpreter
     * @param {CancellationToken} [token]
     * @returns {Promise<boolean>}
     * @memberof JupyterInterpreterConfigurationService
     */
    public async areDependenciesInstalled(interpreter: PythonInterpreter, token?: CancellationToken): Promise<boolean> {
        const [productsNotInstalled, kernelspecIsAvailable] = await Promise.all([
            this.getDependenciesNotInstalled(interpreter, token),
            this.isKernelSpecAvailable(interpreter, token)
        ]);
        return (productsNotInstalled || []).length === 0 && kernelspecIsAvailable;
    }

    private async getDependenciesNotInstalled(interpreter: PythonInterpreter, token?: CancellationToken): Promise<Product[]> {
        const notInstalled: Product[] = [];
        await Promise.race([
            Promise.all([
                this.installer.isInstalled(Product.jupyter, interpreter).then(installed => (installed ? noop() : notInstalled.push(Product.jupyter))),
                this.installer.isInstalled(Product.notebook, interpreter).then(installed => (installed ? noop() : notInstalled.push(Product.notebook)))
            ]),
            createPromiseFromCancellation<void>({ cancelAction: 'resolve', defaultValue: undefined, token })
        ]);

        return Cancellation.isCanceled(token) ? [] : notInstalled;
    }

    /**
     * Checks whether the jupyter sub command kernelspec is available.
     *
     * @private
     * @param {PythonInterpreter} interpreter
     * @param {CancellationToken} [token]
     * @returns {Promise<boolean>}
     * @memberof JupyterInterpreterConfigurationService
     */
    private async isKernelSpecAvailable(interpreter: PythonInterpreter, token?: CancellationToken): Promise<boolean> {
        const execService = await this.pythonExecFactory.createActivatedEnvironment({ interpreter, allowEnvironmentFetchExceptions: true, bypassCondaExecution: true });
        if (Cancellation.isCanceled(token)) {
            return false;
        }
        return execService
            .execModule('jupyter', ['kernelspec', '--version'], { throwOnStdErr: true })
            .then(() => true)
            .catch(() => false);
    }

    /**
     * Even if jupyter module is installed, its possible kernelspec isn't available.
     * Possible user has an old version of jupyter or something is corrupted.
     * This is an edge case, and we need to handle this.
     * Current solution is to get user to select another interpreter or update jupyter/python (we don't know what is wrong).
     *
     * @private
     * @param {PythonInterpreter} interpreter
     * @param {CancellationToken} [token]
     * @returns {Promise<JupyterInterpreterConfigurationResponse>}
     * @memberof JupyterInterpreterConfigurationService
     */
    private async checkKernelSpecAvailability(interpreter: PythonInterpreter, token?: CancellationToken): Promise<JupyterInterpreterConfigurationResponse> {
        if (await this.isKernelSpecAvailable(interpreter)) {
            sendTelemetryEvent(Telemetry.JupyterInstalledButNotKernelSpecModule);
            return JupyterInterpreterConfigurationResponse.ok;
        }
        if (Cancellation.isCanceled(token)) {
            return JupyterInterpreterConfigurationResponse.cancel;
        }
        const selectionFromError = await this.applicationShell.showErrorMessage(
            DataScience.jupyterKernelSpecModuleNotFound().format(interpreter.path),
            DataScience.selectDifferentJupyterInterpreter(),
            Common.cancel()
        );
        return selectionFromError === DataScience.selectDifferentJupyterInterpreter()
            ? JupyterInterpreterConfigurationResponse.selectAnotherInterpreter
            : JupyterInterpreterConfigurationResponse.cancel;
    }
}
