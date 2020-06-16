// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { CancellationToken } from 'vscode';
import { IApplicationShell } from '../../../common/application/types';
import { Cancellation, createPromiseFromCancellation, wrapCancellationTokens } from '../../../common/cancellation';
import { ProductNames } from '../../../common/installer/productNames';
import { traceError } from '../../../common/logger';
import { IInstaller, InstallerResponse, Product } from '../../../common/types';
import { Common, DataScience } from '../../../common/utils/localize';
import { noop } from '../../../common/utils/misc';
import { PythonInterpreter } from '../../../pythonEnvironments/discovery/types';
import { sendTelemetryEvent } from '../../../telemetry';
import { HelpLinks, JupyterCommands, Telemetry } from '../../constants';
import { reportAction } from '../../progress/decorator';
import { ReportableAction } from '../../progress/types';
import { IJupyterCommandFactory } from '../../types';
import { JupyterInstallError } from '../jupyterInstallError';

export enum JupyterInterpreterDependencyResponse {
    ok,
    selectAnotherInterpreter,
    cancel
}

/**
 * Sorts the given list of products (in place) in the order in which they need to be installed.
 * E.g. when installing the modules `notebook` and `Jupyter`, its best to first install `Jupyter`.
 *
 * @param {Product[]} products
 */
function sortProductsInOrderForInstallation(products: Product[]) {
    products.sort((a, b) => {
        if (a === Product.jupyter) {
            return -1;
        }
        if (b === Product.jupyter) {
            return 1;
        }
        if (a === Product.notebook) {
            return -1;
        }
        if (b === Product.notebook) {
            return 1;
        }
        return 0;
    });
}
/**
 * Given a list of products, this will return an error message of the form:
 * `Data Science library jupyter not installed`
 * `Data Science libraries, jupyter and notebook not installed`
 * `Data Science libraries, jupyter, notebook and nbconvert not installed`
 *
 * @export
 * @param {Product[]} products
 * @returns {string}
 */
export function getMessageForLibrariesNotInstalled(products: Product[], interpreterName?: string): string {
    // Even though kernelspec cannot be installed, display it so user knows what is missing.
    const names = products
        .map((product) => ProductNames.get(product))
        .filter((name) => !!name)
        .map((name) => name as string);

    switch (names.length) {
        case 0:
            return '';
        case 1:
            return interpreterName
                ? DataScience.libraryRequiredToLaunchJupyterNotInstalledInterpreter().format(interpreterName, names[0])
                : DataScience.libraryRequiredToLaunchJupyterNotInstalled().format(names[0]);
        default: {
            const lastItem = names.pop();
            return interpreterName
                ? DataScience.librariesRequiredToLaunchJupyterNotInstalledInterpreter().format(
                      interpreterName,
                      `${names.join(', ')} ${Common.and()} ${lastItem}`
                  )
                : DataScience.librariesRequiredToLaunchJupyterNotInstalled().format(
                      `${names.join(', ')} ${Common.and()} ${lastItem}`
                  );
        }
    }
}

/**
 * Responsible for managing dependencies of a Python interpreter required to run Jupyter.
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
     * E.g. every time a user makes a request to get the interpreter information, we use the cache if everything is ok.
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
        @inject(IJupyterCommandFactory) private readonly commandFactory: IJupyterCommandFactory
    ) {}
    /**
     * Configures the python interpreter to ensure it can run Jupyter server by installing any missing dependencies.
     * If user opts not to install they can opt to select another interpreter.
     *
     * @param {PythonInterpreter} interpreter
     * @param {JupyterInstallError} [_error]
     * @param {CancellationToken} [token]
     * @returns {Promise<JupyterInterpreterDependencyResponse>}
     * @memberof JupyterInterpreterDependencyService
     */
    @reportAction(ReportableAction.InstallingMissingDependencies)
    public async installMissingDependencies(
        interpreter: PythonInterpreter,
        _error?: JupyterInstallError,
        token?: CancellationToken
    ): Promise<JupyterInterpreterDependencyResponse> {
        const missingProducts = await this.getDependenciesNotInstalled(interpreter, token);
        if (Cancellation.isCanceled(token)) {
            return JupyterInterpreterDependencyResponse.cancel;
        }
        if (missingProducts.length === 0) {
            return JupyterInterpreterDependencyResponse.ok;
        }

        const message = getMessageForLibrariesNotInstalled(missingProducts, interpreter.displayName);

        sendTelemetryEvent(Telemetry.JupyterNotInstalledErrorShown);
        const selection = await this.applicationShell.showErrorMessage(
            message,
            DataScience.jupyterInstall(),
            DataScience.selectDifferentJupyterInterpreter(),
            DataScience.pythonInteractiveHelpLink()
        );

        if (Cancellation.isCanceled(token)) {
            return JupyterInterpreterDependencyResponse.cancel;
        }

        switch (selection) {
            case DataScience.jupyterInstall(): {
                // Ignore kernelspec as it not something that can be installed.
                // If kernelspec isn't available, then re-install `Jupyter`.
                if (missingProducts.includes(Product.kernelspec) && !missingProducts.includes(Product.jupyter)) {
                    missingProducts.push(Product.jupyter);
                }
                const productsToInstall = missingProducts.filter((product) => product !== Product.kernelspec);
                // Install jupyter, then notebook, then others in that order.
                sortProductsInOrderForInstallation(productsToInstall);

                let productToInstall = productsToInstall.shift();
                const cancellatonPromise = createPromiseFromCancellation({
                    cancelAction: 'resolve',
                    defaultValue: InstallerResponse.Ignore,
                    token
                });
                while (productToInstall) {
                    // Always pass a cancellation token to `install`, to ensure it waits until the module is installed.
                    const response = await Promise.race([
                        this.installer.install(productToInstall, interpreter, wrapCancellationTokens(token)),
                        cancellatonPromise
                    ]);
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

            case DataScience.pythonInteractiveHelpLink(): {
                this.applicationShell.openUrl(HelpLinks.PythonInteractiveHelpLink);
                sendTelemetryEvent(Telemetry.UserDidNotInstallJupyter);
                return JupyterInterpreterDependencyResponse.cancel;
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
        return this.getDependenciesNotInstalled(interpreter, token).then((items) => items.length === 0);
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
        const installed = this.installer.isInstalled(Product.nbconvert, interpreter).then((result) => result === true);
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
    public async getDependenciesNotInstalled(
        interpreter: PythonInterpreter,
        token?: CancellationToken
    ): Promise<Product[]> {
        // If we know that all modules were available at one point in time, then use that cache.
        if (this.dependenciesInstalledInInterpreter.has(interpreter.path)) {
            return [];
        }

        const notInstalled: Product[] = [];
        await Promise.race([
            Promise.all([
                this.installer
                    .isInstalled(Product.jupyter, interpreter)
                    .then((installed) => (installed ? noop() : notInstalled.push(Product.jupyter))),
                this.installer
                    .isInstalled(Product.notebook, interpreter)
                    .then((installed) => (installed ? noop() : notInstalled.push(Product.notebook)))
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
        const products = await this.isKernelSpecAvailable(interpreter, token).then((installed) =>
            installed ? [] : [Product.kernelspec]
        );
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
    private async isKernelSpecAvailable(interpreter: PythonInterpreter, _token?: CancellationToken): Promise<boolean> {
        const command = this.commandFactory.createInterpreterCommand(
            JupyterCommands.KernelSpecCommand,
            'jupyter',
            ['-m', 'jupyter', 'kernelspec'],
            interpreter,
            false
        );
        return command
            .exec(['--version'], { throwOnStdErr: true })
            .then(() => true)
            .catch((e) => {
                traceError(`Kernel spec not found: `, e);
                sendTelemetryEvent(Telemetry.KernelSpecNotFound);
                return false;
            });
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
    private async checkKernelSpecAvailability(
        interpreter: PythonInterpreter,
        token?: CancellationToken
    ): Promise<JupyterInterpreterDependencyResponse> {
        if (await this.isKernelSpecAvailable(interpreter)) {
            return JupyterInterpreterDependencyResponse.ok;
        }
        // Indicate no kernel spec module.
        sendTelemetryEvent(Telemetry.JupyterInstalledButNotKernelSpecModule);
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
