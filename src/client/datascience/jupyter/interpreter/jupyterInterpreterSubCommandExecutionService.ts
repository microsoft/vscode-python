// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import * as path from 'path';
import { CancellationToken } from 'vscode';
import { Cancellation } from '../../../common/cancellation';
import { traceError, traceInfo, traceWarning } from '../../../common/logger';
import { IFileSystem } from '../../../common/platform/types';
import { IPythonExecutionFactory, ObservableExecutionResult, SpawnOptions } from '../../../common/process/types';
import { IOutputChannel, IPathUtils, Product } from '../../../common/types';
import { DataScience } from '../../../common/utils/localize';
import { noop } from '../../../common/utils/misc';
import { EXTENSION_ROOT_DIR } from '../../../constants';
import { IInterpreterService, PythonInterpreter } from '../../../interpreter/contracts';
import { sendTelemetryEvent } from '../../../telemetry';
import { JUPYTER_OUTPUT_CHANNEL, PythonDaemonModule, Telemetry } from '../../constants';
import { IJupyterInterpreterDependencyManager, IJupyterSubCommandExecutionService } from '../../types';
import { JupyterServerInfo } from '../jupyterConnection';
import { JupyterInstallError } from '../jupyterInstallError';
import { JupyterKernelSpec, parseKernelSpecs } from '../kernels/jupyterKernelSpec';
import {
    getMessageForLibrariesNotInstalled,
    JupyterInterpreterDependencyService
} from './jupyterInterpreterDependencyService';
import { JupyterInterpreterService } from './jupyterInterpreterService';

/**
 * Responsible for execution of jupyter sub commands using a single/global interpreter set aside for launching jupyter server.
 *
 * @export
 * @class JupyterCommandFinderInterpreterExecutionService
 * @implements {IJupyterSubCommandExecutionService}
 */
@injectable()
export class JupyterInterpreterSubCommandExecutionService
    implements IJupyterSubCommandExecutionService, IJupyterInterpreterDependencyManager {
    constructor(
        @inject(JupyterInterpreterService) private readonly jupyterInterpreter: JupyterInterpreterService,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(JupyterInterpreterDependencyService)
        private readonly jupyterDependencyService: JupyterInterpreterDependencyService,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(IPythonExecutionFactory) private readonly pythonExecutionFactory: IPythonExecutionFactory,
        @inject(IOutputChannel) @named(JUPYTER_OUTPUT_CHANNEL) private readonly jupyterOutputChannel: IOutputChannel,
        @inject(IPathUtils) private readonly pathUtils: IPathUtils
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
        return this.jupyterDependencyService.areDependenciesInstalled(interpreter, token);
    }
    public async isExportSupported(token?: CancellationToken): Promise<boolean> {
        const interpreter = await this.jupyterInterpreter.getSelectedInterpreter(token);
        if (!interpreter) {
            return false;
        }
        return this.jupyterDependencyService.isExportSupported(interpreter, token);
    }
    public async getReasonForJupyterNotebookNotBeingSupported(token?: CancellationToken): Promise<string> {
        let interpreter = await this.jupyterInterpreter.getSelectedInterpreter(token);
        if (!interpreter) {
            // Use current interpreter.
            interpreter = await this.interpreterService.getActiveInterpreter(undefined);
            if (!interpreter) {
                // Unlikely scenario, user hasn't selected python, python extension will fall over.
                // Get user to select something.
                return DataScience.selectJupyterInterpreter();
            }
        }
        const productsNotInstalled = await this.jupyterDependencyService.getDependenciesNotInstalled(
            interpreter,
            token
        );
        if (productsNotInstalled.length === 0) {
            return '';
        }

        if (productsNotInstalled.length === 1 && productsNotInstalled[0] === Product.kernelspec) {
            return DataScience.jupyterKernelSpecModuleNotFound().format(interpreter.path);
        }

        return getMessageForLibrariesNotInstalled(productsNotInstalled, interpreter.displayName);
    }
    public async getSelectedInterpreter(token?: CancellationToken): Promise<PythonInterpreter | undefined> {
        return this.jupyterInterpreter.getSelectedInterpreter(token);
    }
    public async startNotebook(
        notebookArgs: string[],
        options: SpawnOptions
    ): Promise<ObservableExecutionResult<string>> {
        const interpreter = await this.getSelectedInterpreterAndThrowIfNotAvailable(options.token);
        this.jupyterOutputChannel.appendLine(
            DataScience.startingJupyterLogMessage().format(
                this.pathUtils.getDisplayName(interpreter.path),
                notebookArgs.join(' ')
            )
        );
        const executionService = await this.pythonExecutionFactory.createDaemon({
            daemonModule: PythonDaemonModule,
            pythonPath: interpreter.path
        });
        return executionService.execModuleObservable('jupyter', ['notebook'].concat(notebookArgs), options);
    }

    public async getRunningJupyterServers(token?: CancellationToken): Promise<JupyterServerInfo[] | undefined> {
        const interpreter = await this.getSelectedInterpreterAndThrowIfNotAvailable(token);
        const daemon = await this.pythonExecutionFactory.createDaemon({
            daemonModule: PythonDaemonModule,
            pythonPath: interpreter.path
        });

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
        const interpreter = await this.getSelectedInterpreterAndThrowIfNotAvailable(token);
        if (!(await this.jupyterDependencyService.isExportSupported(interpreter, token))) {
            throw new Error(DataScience.jupyterNbConvertNotSupported());
        }

        const daemon = await this.pythonExecutionFactory.createDaemon({
            daemonModule: PythonDaemonModule,
            pythonPath: interpreter.path
        });
        // Wait for the nbconvert to finish
        const args = template
            ? [file, '--to', 'python', '--stdout', '--template', template]
            : [file, '--to', 'python', '--stdout'];
        // Ignore stderr, as nbconvert writes conversion result to stderr.
        // stdout contains the generated python code.
        return daemon
            .execModule('jupyter', ['nbconvert'].concat(args), { throwOnStdErr: false, encoding: 'utf8', token })
            .then(output => output.stdout);
    }
    public async openNotebook(notebookFile: string): Promise<void> {
        const interpreter = await this.getSelectedInterpreterAndThrowIfNotAvailable();
        // Do  not use the daemon for this, its a waste resources. The user will manage the lifecycle of this process.
        const executionService = await this.pythonExecutionFactory.createActivatedEnvironment({
            interpreter,
            bypassCondaExecution: true,
            allowEnvironmentFetchExceptions: true
        });
        const args: string[] = [`--NotebookApp.file_to_run=${notebookFile}`];

        // Don't wait for the exec to finish and don't dispose. It's up to the user to kill the process
        executionService
            .execModule('jupyter', ['notebook'].concat(args), { throwOnStdErr: false, encoding: 'utf8' })
            .ignoreErrors();
    }

    public async getKernelSpecs(token?: CancellationToken): Promise<JupyterKernelSpec[]> {
        const interpreter = await this.getSelectedInterpreterAndThrowIfNotAvailable(token);
        const daemon = await this.pythonExecutionFactory.createDaemon({
            daemonModule: PythonDaemonModule,
            pythonPath: interpreter.path
        });
        if (Cancellation.isCanceled(token)) {
            return [];
        }
        try {
            traceInfo('Asking for kernelspecs from jupyter');
            const spawnOptions = { throwOnStdErr: true, encoding: 'utf8' };
            // Ask for our current list.
            const stdoutFromDaemonPromise = await daemon
                .execModule('jupyter', ['kernelspec', 'list', '--json'], spawnOptions)
                .then(output => output.stdout)
                .catch(daemonEx => {
                    sendTelemetryEvent(Telemetry.KernelSpecNotFound);
                    traceError('Failed to list kernels from daemon', daemonEx);
                    return '';
                });
            // Possible we cannot import ipykernel for some reason. (use as backup option).
            const stdoutFromFileExecPromise = daemon
                .exec(
                    [path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'datascience', 'getJupyterKernels.py')],
                    spawnOptions
                )
                .then(output => output.stdout)
                .catch(fileEx => {
                    traceError('Failed to list kernels from getJupyterKernels.py', fileEx);
                    return '';
                });

            const [stdoutFromDaemon, stdoutFromFileExec] = await Promise.all([
                stdoutFromDaemonPromise,
                stdoutFromFileExecPromise
            ]);

            return parseKernelSpecs(stdoutFromDaemon || stdoutFromFileExec, this.fs, token).catch(parserError => {
                traceError('Failed to parse kernelspecs', parserError);
                // This is failing for some folks. In that case return nothing
                return [];
            });
        } catch (ex) {
            traceError('Failed to list kernels', ex);
            // This is failing for some folks. In that case return nothing
            return [];
        }
    }

    public async installMissingDependencies(err?: JupyterInstallError): Promise<void> {
        await this.jupyterInterpreter.installMissingDependencies(err);
    }

    private async getSelectedInterpreterAndThrowIfNotAvailable(token?: CancellationToken): Promise<PythonInterpreter> {
        const interpreter = await this.jupyterInterpreter.getSelectedInterpreter(token);
        if (!interpreter) {
            const reason = await this.getReasonForJupyterNotebookNotBeingSupported();
            throw new JupyterInstallError(reason, DataScience.pythonInteractiveHelpLink());
        }
        return interpreter;
    }
}
