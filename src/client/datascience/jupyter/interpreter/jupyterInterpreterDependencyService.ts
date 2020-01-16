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
import { JupyterInstallError } from '../jupyterInstallError';

export enum JupyterInterpreterDependencyResponse {
    ok,
    selectAnotherInterpreter,
    cancel
}

/**
 * Responsible for managing depedencies of a Python interpreter required to run Jupyter.
 * If required modules aren't installed, will prompt user to install them or select another interpreter.
 *
 * @export
 * @class JupyterInterpreterDependencyService
 */
@injectable()
export class JupyterInterpreterDependencyService {
    /**
     * Keeps track of the fact that all dependencies are available in an interpreter.
     * This cache will be cleared only after reloading VS Code or when the background code detects that modules are not available.
     * E.g. everytime a user makes a request to get the interpreter information, we use the cache if everything is ok.
     * However we still run the code in the background to check if the modules are available, and then update the cache with the results.
     *
     * @private
     * @memberof JupyterInterpreterDependencyService
     */
    private readonly dependenciesInstalledInInterpreter = new Set<string>();
    /**
     * Same as `dependenciesInstalledInInterpreter`.
     *
     * @private
     * @memberof JupyterInterpreterDependencyService
     */
    private readonly nbconvertInstalledInInterpreter = new Set<string>();
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
     * @param {JupyterInstallError} [_error]
     * @param {CancellationToken} [token]
     * @returns {Promise<JupyterInterpreterDependencyResponse>}
     * @memberof JupyterInterpreterDependencyService
     */
    public async installMissingDependencies(
        interpreter: PythonInterpreter,
        _error?: JupyterInstallError,
        token?: CancellationToken
    ): Promise<JupyterInterpreterDependencyResponse> {
        const productsToInstall = await this.getDependenciesNotInstalled(interpreter, token);
        if (Cancellation.isCanceled(token)) {
            return JupyterInterpreterDependencyResponse.cancel;
        }
        if (productsToInstall.length === 0) {
            return JupyterInterpreterDependencyResponse.ok;
        }

        const names = productsToInstall
            // Ignore kernelspec as it not something that can be installed.
            .filter(product => product !== Product.kernelspec)
            .map(product => ProductNames.get(product))
            .filter(name => !!name)
            .map(name => name as string);
        const message = DataScience.libraryNotInstalled().format(names.join(` ${Common.and()} `));

        sendTelemetryEvent(Telemetry.JupyterNotInstalledErrorShown);
        const selection = await this.applicationShell.showErrorMessage(
            // tslint:disable-next-line: messages-must-be-localized
            `${message}\r\n${DataScience.markdownHelpInstallingMissingDependencies()}`,
            DataScience.jupyterInstall(),
            DataScience.selectDifferentJupyterInterpreter(),
            Common.cancel()
        );

        if (Cancellation.isCanceled(token)) {
            return JupyterInterpreterDependencyResponse.cancel;
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
                        return JupyterInterpreterDependencyResponse.cancel;
                    }
                }
                sendTelemetryEvent(Telemetry.UserInstalledJupyter);

                // Check if kernelspec module is something that accessible.
                return this.checkKernelSpecAvailability(interpreter);
            }

            case DataScience.selectDifferentJupyterInterpreter(): {
                sendTelemetryEvent(Telemetry.UserDidNotInstallJupyter);
                return JupyterInterpreterDependencyResponse.selectAnotherInterpreter;
            }

            default:
                sendTelemetryEvent(Telemetry.UserDidNotInstallJupyter);
                return JupyterInterpreterDependencyResponse.cancel;
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
        return this.getDependenciesNotInstalled(interpreter, token).then(items => items.length === 0);
    }

    /**
     * Whether its possible to export ipynb to other formats.
     * Basically checks whether nbconvert is installed.
     *
     * @param {PythonInterpreter} interpreter
     * @param {CancellationToken} [_token]
     * @returns {Promise<boolean>}
     * @memberof JupyterInterpreterConfigurationService
     */
    public async isExportSupported(interpreter: PythonInterpreter, _token?: CancellationToken): Promise<boolean> {
        if (this.nbconvertInstalledInInterpreter.has(interpreter.path)) {
            return true;
        }
        const installed = this.installer.isInstalled(Product.nbconvert, interpreter).then(result => result === true);
        if (installed) {
            this.nbconvertInstalledInInterpreter.add(interpreter.path);
        }
        return installed;
    }

    /**
     * Gets a list of the dependencies not installed, dependencies that are required to launch the jupyter notebook server.
     *
     * @param {PythonInterpreter} interpreter
     * @param {CancellationToken} [token]
     * @returns {Promise<Product[]>}
     * @memberof JupyterInterpreterConfigurationService
     */
    public async getDependenciesNotInstalled(interpreter: PythonInterpreter, token?: CancellationToken): Promise<Product[]> {
        // If we know that all modules were available at one point in time, then use that cache.
        if (this.dependenciesInstalledInInterpreter.has(interpreter.path)) {
            return [];
        }

        const notInstalled: Product[] = [];
        await Promise.race([
            Promise.all([
                this.installer.isInstalled(Product.jupyter, interpreter).then(installed => (installed ? noop() : notInstalled.push(Product.jupyter))),
                this.installer.isInstalled(Product.notebook, interpreter).then(installed => (installed ? noop() : notInstalled.push(Product.notebook)))
            ]),
            createPromiseFromCancellation<void>({ cancelAction: 'resolve', defaultValue: undefined, token })
        ]);

        if (notInstalled.length > 0) {
            return notInstalled;
        }
        if (Cancellation.isCanceled(token)) {
            return [];
        }
        // Perform this check only if jupyter & notebook modules are installed.
        const products = await this.isKernelSpecAvailable(interpreter, token).then(installed => (installed ? [] : [Product.kernelspec]));
        if (products.length === 0) {
            this.dependenciesInstalledInInterpreter.add(interpreter.path);
        }
        return products;
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
     * @returns {Promise<JupyterInterpreterDependencyResponse>}
     * @memberof JupyterInterpreterConfigurationService
     */
    private async checkKernelSpecAvailability(interpreter: PythonInterpreter, token?: CancellationToken): Promise<JupyterInterpreterDependencyResponse> {
        if (await this.isKernelSpecAvailable(interpreter)) {
            sendTelemetryEvent(Telemetry.JupyterInstalledButNotKernelSpecModule);
            return JupyterInterpreterDependencyResponse.ok;
        }
        if (Cancellation.isCanceled(token)) {
            return JupyterInterpreterDependencyResponse.cancel;
        }
        const selectionFromError = await this.applicationShell.showErrorMessage(
            DataScience.jupyterKernelSpecModuleNotFound().format(interpreter.path),
            DataScience.selectDifferentJupyterInterpreter(),
            Common.cancel()
        );
        return selectionFromError === DataScience.selectDifferentJupyterInterpreter()
            ? JupyterInterpreterDependencyResponse.selectAnotherInterpreter
            : JupyterInterpreterDependencyResponse.cancel;
    }
}
