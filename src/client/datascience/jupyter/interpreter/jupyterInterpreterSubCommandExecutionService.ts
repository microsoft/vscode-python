// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Kernel } from '@jupyterlab/services';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import { CancellationToken } from 'vscode';
import { Cancellation, createPromiseFromCancellation } from '../../../common/cancellation';
import { ProductNames } from '../../../common/installer/productNames';
import { traceError, traceInfo, traceWarning } from '../../../common/logger';
import { IFileSystem } from '../../../common/platform/types';
import { IPythonExecutionFactory, ObservableExecutionResult, SpawnOptions } from '../../../common/process/types';
import { Product } from '../../../common/types';
import { Common, DataScience } from '../../../common/utils/localize';
import { noop } from '../../../common/utils/misc';
import { EXTENSION_ROOT_DIR } from '../../../constants';
import { IInterpreterService, PythonInterpreter } from '../../../interpreter/contracts';
import { PythonDaemonModule } from '../../constants';
import { IJupyterInterpreterDependencyManager, IJupyterSubCommandExecutionService } from '../../types';
import { JupyterServerInfo } from '../jupyterConnection';
import { JupyterInstallError } from '../jupyterInstallError';
import { JupyterKernelSpec } from '../kernels/jupyterKernelSpec';
import { JupyterInterpreterDependencyService } from './jupyterInterpreterDependencyService';
import { JupyterInterpreterService } from './jupyterInterpreterService';

/**
 * Responsible for execution of jupyter sub commands using a single/global interpreter set aside for launching jupyter server.
 *
 * @export
 * @class JupyterCommandFinderInterpreterExecutionService
 * @implements {IJupyterSubCommandExecutionService}
 */
@injectable()
export class JupyterInterpreterSubCommandExecutionService implements IJupyterSubCommandExecutionService, IJupyterInterpreterDependencyManager {
    constructor(
        @inject(JupyterInterpreterService) private readonly jupyterInterpreter: JupyterInterpreterService,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(JupyterInterpreterDependencyService) private readonly jupyterConfigurationService: JupyterInterpreterDependencyService,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(IPythonExecutionFactory) private readonly pythonExecutionFactory: IPythonExecutionFactory
    ) {}

    /**
     * This is a noop, implemented for backwards compatibility.
     *
     * @returns {Promise<void>}
     * @memberof JupyterInterpreterSubCommandExecutionService
     */
    public async refreshCommands(): Promise<void> {
        noop();
    }
    public async isNotebookSupported(token?: CancellationToken): Promise<boolean> {
        const interpreter = await this.jupyterInterpreter.getSelectedInterpreter(token);
        if (!interpreter) {
            return false;
        }
        return this.jupyterConfigurationService.areDependenciesInstalled(interpreter, token);
    }
    public async isExportSupported(token?: CancellationToken): Promise<boolean> {
        const interpreter = await this.jupyterInterpreter.getSelectedInterpreter(token);
        if (!interpreter) {
            return false;
        }
        return this.jupyterConfigurationService.isExportSupported(interpreter, token);
    }
    public async getReasonForJupyterNotebookNotBeingSupported(token?: CancellationToken): Promise<string> {
        const interpreter = await this.jupyterInterpreter.getSelectedInterpreter(token);
        if (!interpreter) {
            return DataScience.selectJupyterInterpreter();
        }
        const productsNotInstalled = await this.jupyterConfigurationService.getDependenciesNotInstalled(interpreter, token);
        if (productsNotInstalled.length === 0) {
            return '';
        }

        if (productsNotInstalled.length === 1 && productsNotInstalled[0] === Product.kernelspec) {
            return DataScience.jupyterKernelSpecModuleNotFound();
        }

        const names = productsNotInstalled
            .map(product => ProductNames.get(product))
            .filter(name => !!name)
            .map(name => name as string);
        return DataScience.libraryRequiredToLaunchJupyterNotInstalled().format(names.join(` ${Common.and} `));
    }
    public async getSelectedInterpreter(token?: CancellationToken): Promise<PythonInterpreter | undefined> {
        return this.jupyterInterpreter.getSelectedInterpreter(token);
    }
    public async startNotebook(notebookArgs: string[], options: SpawnOptions): Promise<ObservableExecutionResult<string>> {
        await this.checkNotebookCommand(options.token);
        const interpreter = await this.jupyterInterpreter.getSelectedInterpreter(options.token);
        if (!interpreter) {
            throw new JupyterInstallError(DataScience.selectJupyterInterpreter(), DataScience.pythonInteractiveHelpLink());
        }
        const executionService = await this.pythonExecutionFactory.createDaemon({ daemonModule: PythonDaemonModule, pythonPath: interpreter.path });
        return executionService.execModuleObservable('jupyter', ['notebook'].concat(notebookArgs), options);
    }

    public async getRunningJupyterServers(token?: CancellationToken): Promise<JupyterServerInfo[] | undefined> {
        const interpreter = await this.jupyterInterpreter.getSelectedInterpreter(token);
        if (!interpreter) {
            throw new JupyterInstallError(DataScience.selectJupyterInterpreter(), DataScience.pythonInteractiveHelpLink());
        }
        const daemon = await this.pythonExecutionFactory.createDaemon({ daemonModule: PythonDaemonModule, pythonPath: interpreter.path });

        // We have a small python file here that we will execute to get the server info from all running Jupyter instances
        const newOptions: SpawnOptions = { mergeStdOutErr: true, token: token };
        const file = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'datascience', 'getServerInfo.py');
        const serverInfoString = await daemon.exec([file], newOptions);

        let serverInfos: JupyterServerInfo[];
        try {
            // Parse out our results, return undefined if we can't suss it out
            serverInfos = JSON.parse(serverInfoString.stdout.trim()) as JupyterServerInfo[];
        } catch (err) {
            traceWarning('Failed to parse JSON when getting server info out from getServerInfo.py', err);
            return;
        }
        return serverInfos;
    }
    public async exportNotebookToPython(file: string, template?: string, token?: CancellationToken): Promise<string> {
        const interpreter = await this.jupyterInterpreter.getSelectedInterpreter(token);
        if (!interpreter) {
            throw new JupyterInstallError(DataScience.selectJupyterInterpreter(), DataScience.pythonInteractiveHelpLink());
        }
        if (!(await this.jupyterConfigurationService.isExportSupported(interpreter, token))) {
            throw new Error(DataScience.jupyterNbConvertNotSupported());
        }

        const daemon = await this.pythonExecutionFactory.createDaemon({ daemonModule: PythonDaemonModule, pythonPath: interpreter.path });
        // Wait for the nbconvert to finish
        const args = template ? [file, '--to', 'python', '--stdout', '--template', template] : [file, '--to', 'python', '--stdout'];
        return daemon.execModule('jupyter', ['nbconvert'].concat(args), { throwOnStdErr: true, encoding: 'utf8', token }).then(output => output.stdout);
    }
    public async launchNotebook(notebookFile: string): Promise<void> {
        await this.checkNotebookCommand();
        const interpreter = await this.jupyterInterpreter.getSelectedInterpreter();
        if (!interpreter) {
            throw new JupyterInstallError(DataScience.selectJupyterInterpreter(), DataScience.pythonInteractiveHelpLink());
        }
        const executionService = await this.pythonExecutionFactory.createActivatedEnvironment({ interpreter, bypassCondaExecution: true, allowEnvironmentFetchExceptions: true });
        const args: string[] = [`--NotebookApp.file_to_run=${notebookFile}`];

        // Don't wait for the exec to finish and don't dispose. It's up to the user to kill the process
        executionService.execModule('jupyter', ['notebook'].concat(args), { throwOnStdErr: false, encoding: 'utf8' }).ignoreErrors();
    }

    public async getKernelSpecs(token?: CancellationToken): Promise<JupyterKernelSpec[]> {
        await this.checkNotebookCommand();
        const interpreter = await this.jupyterInterpreter.getSelectedInterpreter(token);
        if (!interpreter) {
            throw new JupyterInstallError(DataScience.selectJupyterInterpreter(), DataScience.pythonInteractiveHelpLink());
        }
        const daemon = await this.pythonExecutionFactory.createDaemon({ daemonModule: PythonDaemonModule, pythonPath: interpreter.path });
        if (Cancellation.isCanceled(token)) {
            return [];
        }
        try {
            traceInfo('Asking for kernelspecs from jupyter');

            // Ask for our current list.
            const output = await daemon.execModule('jupyter', ['kernelspec', 'list', '--json'], { throwOnStdErr: true, encoding: 'utf8' });

            traceInfo('Parsing kernelspecs from jupyter');
            // This should give us back a key value pair we can parse
            const jsOut = JSON.parse(output.stdout.trim()) as { kernelspecs: Record<string, { resource_dir: string; spec: Omit<Kernel.ISpecModel, 'name'> }> };
            const kernelSpecs = jsOut.kernelspecs;
            const specs = await Promise.race([
                Promise.all(
                    Object.keys(kernelSpecs).map(async kernelName => {
                        const specFile = path.join(kernelSpecs[kernelName].resource_dir, 'kernel.json');
                        const spec = kernelSpecs[kernelName].spec;
                        // Add the missing name property.
                        const model = {
                            ...spec,
                            name: kernelName
                        };
                        // Check if the spec file exists.
                        if (await this.fs.fileExists(specFile)) {
                            return new JupyterKernelSpec(model as Kernel.ISpecModel, specFile);
                        } else {
                            return;
                        }
                    })
                ),
                createPromiseFromCancellation({ cancelAction: 'resolve', defaultValue: [], token })
            ]);
            return specs.filter(item => !!item).map(item => item as JupyterKernelSpec);
        } catch (ex) {
            traceError('Failed to list kernels', ex);
            // This is failing for some folks. In that case return nothing
            return [];
        }
    }

    public async installMissingDependencies(err?: JupyterInstallError): Promise<void> {
        let interpreter = await this.jupyterInterpreter.getSelectedInterpreter();
        if (!interpreter) {
            // Use current interpreter.
            interpreter = await this.interpreterService.getActiveInterpreter(undefined);
            if (!interpreter) {
                // Unlikely scenario, user hasn't selected python, python extension will fall over.
                // Get user to select something.
                await this.jupyterInterpreter.selectInterpreter();
                return;
            }
        }

        await this.jupyterConfigurationService.installMissingDependencies(interpreter, err);
    }

    private async checkNotebookCommand(token?: CancellationToken): Promise<void> {
        const reason = await this.getReasonForJupyterNotebookNotBeingSupported(token);
        if (reason) {
            throw new JupyterInstallError(reason, DataScience.pythonInteractiveHelpLink());
        }
    }
}
