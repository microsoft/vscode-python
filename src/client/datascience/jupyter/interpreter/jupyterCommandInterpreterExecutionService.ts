// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { CancellationToken } from 'vscode';
import { Cancellation } from '../../../common/cancellation';
import { traceError, traceInfo, traceWarning } from '../../../common/logger';
import { IFileSystem } from '../../../common/platform/types';
import { IPythonExecutionFactory, ObservableExecutionResult, SpawnOptions } from '../../../common/process/types';
import { DataScience } from '../../../common/utils/localize';
import { noop } from '../../../common/utils/misc';
import { EXTENSION_ROOT_DIR } from '../../../constants';
import { IInterpreterService, PythonInterpreter } from '../../../interpreter/contracts';
import { JupyterCommands, PythonDaemonModule } from '../../constants';
import { IJupyterSubCommandExecutionService } from '../../types';
import { JupyterServerInfo } from '../jupyterConnection';
import { JupyterInstallError } from '../jupyterInstallError';
import { JupyterKernelSpec, parseKernelSpecs } from '../kernels/jupyterKernelSpec';
import { IFindCommandResult, JupyterCommandFinder } from './jupyterCommandFinder';

/**
 * Responsible for execution of jupyter sub commands using the command finder and related classes.
 * The plan is to deprecate this class in the future along with to JupyterCommandFinder and related classes.
 *
 * @export
 * @class JupyterCommandFinderInterpreterExecutionService
 * @implements {IJupyterSubCommandExecutionService}
 */
@injectable()
export class JupyterCommandFinderInterpreterExecutionService implements IJupyterSubCommandExecutionService {
    constructor(
        @inject(JupyterCommandFinder) private readonly commandFinder: JupyterCommandFinder,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(IPythonExecutionFactory) private readonly pythonExecutionFactory: IPythonExecutionFactory
    ) {}

    public refreshCommands(): Promise<void> {
        return this.commandFinder.clearCache();
    }
    public async isNotebookSupported(cancelToken?: CancellationToken): Promise<boolean> {
        // See if we can find the command notebook
        return Cancellation.race(() => this.isCommandSupported(JupyterCommands.NotebookCommand, cancelToken), cancelToken);
    }
    public async isExportSupported(cancelToken?: CancellationToken): Promise<boolean> {
        // See if we can find the command nbconvert
        return Cancellation.race(() => this.isCommandSupported(JupyterCommands.ConvertCommand, cancelToken), cancelToken);
    }
    public async getReasonForJupyterNotebookNotBeingSupported(): Promise<string> {
        const notebook = await this.commandFinder.findBestCommand(JupyterCommands.NotebookCommand);
        return notebook.error ? notebook.error : DataScience.notebookNotFound();
    }
    public async getSelectedInterpreter(token?: CancellationToken): Promise<PythonInterpreter | undefined> {
        // This should be the best interpreter for notebooks
        const found = await this.commandFinder.findBestCommand(JupyterCommands.NotebookCommand, token);
        if (found && found.command) {
            return found.command.interpreter();
        }

        return undefined;
    }
    public async startNotebook(notebookArgs: string[], options: SpawnOptions): Promise<ObservableExecutionResult<string>> {
        // First we find a way to start a notebook server
        const notebookCommand = await this.commandFinder.findBestCommand(JupyterCommands.NotebookCommand);
        this.checkNotebookCommand(notebookCommand);
        return notebookCommand!.command!.execObservable(notebookArgs, options);
    }

    public async getRunningJupyterServers(token?: CancellationToken): Promise<JupyterServerInfo[] | undefined> {
        const [interpreter, activeInterpreter] = await Promise.all([this.getSelectedInterpreter(token), this.interpreterService.getActiveInterpreter()]);
        if (!interpreter) {
            return;
        }
        // Create a daemon only when using the current interpreter.
        // We dont' want to create daemons for all interpreters.
        const isActiveInterpreter = activeInterpreter ? activeInterpreter.path === interpreter.path : false;
        const daemon = await (isActiveInterpreter
            ? this.pythonExecutionFactory.createDaemon({ daemonModule: PythonDaemonModule, pythonPath: interpreter.path })
            : this.pythonExecutionFactory.createActivatedEnvironment({ allowEnvironmentFetchExceptions: true, interpreter, bypassCondaExecution: true }));

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
        // First we find a way to start a nbconvert
        const convert = await this.commandFinder.findBestCommand(JupyterCommands.ConvertCommand);
        if (!convert.command) {
            throw new Error(DataScience.jupyterNbConvertNotSupported());
        }

        // Wait for the nbconvert to finish
        const args = template ? [file, '--to', 'python', '--stdout', '--template', template] : [file, '--to', 'python', '--stdout'];
        return convert.command.exec(args, { throwOnStdErr: false, encoding: 'utf8', token }).then(output => output.stdout);
    }
    public async openNotebook(notebookFile: string): Promise<void> {
        // First we find a way to start a notebook server
        const notebookCommand = await this.commandFinder.findBestCommand(JupyterCommands.NotebookCommand);
        this.checkNotebookCommand(notebookCommand);

        const args: string[] = [`--NotebookApp.file_to_run=${notebookFile}`];

        // Don't wait for the exec to finish and don't dispose. It's up to the user to kill the process
        notebookCommand.command!.exec(args, { throwOnStdErr: false, encoding: 'utf8' }).ignoreErrors();
    }

    public async getKernelSpecs(token?: CancellationToken): Promise<JupyterKernelSpec[]> {
        // Ignore errors if there are no kernels.
        const kernelSpecCommand = await this.commandFinder.findBestCommand(JupyterCommands.KernelSpecCommand).catch(noop);

        if (!kernelSpecCommand || !kernelSpecCommand.command) {
            return [];
        }
        if (Cancellation.isCanceled(token)) {
            return [];
        }
        try {
            traceInfo('Asking for kernelspecs from jupyter');

            // Ask for our current list.
            const output = await kernelSpecCommand.command.exec(['list', '--json'], { throwOnStdErr: true, encoding: 'utf8' });

            return parseKernelSpecs(output.stdout, this.fs, token).catch(parserError => {
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
    private checkNotebookCommand(notebook: IFindCommandResult) {
        if (!notebook.command) {
            const errorMessage = notebook.error ? notebook.error : DataScience.notebookNotFound();
            throw new JupyterInstallError(DataScience.jupyterNotSupported().format(errorMessage), DataScience.pythonInteractiveHelpLink());
        }
    }
    private async isCommandSupported(command: JupyterCommands, cancelToken?: CancellationToken): Promise<boolean> {
        // See if we can find the command
        try {
            const result = await this.commandFinder.findBestCommand(command, cancelToken);

            // Note to self, if result is undefined, check that your test is actually
            // setting up different services correctly. Some method must be undefined.
            return result.command !== undefined;
        } catch (err) {
            traceWarning(`Checking command ${command}`, err);
            return false;
        }
    }
}
