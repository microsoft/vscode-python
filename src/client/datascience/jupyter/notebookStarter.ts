// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as cp from 'child_process';
import { inject, injectable, named } from 'inversify';
import * as os from 'os';
import * as path from 'path';
import * as uuid from 'uuid/v4';
import { CancellationToken, Disposable } from 'vscode';
import { CancellationError } from '../../common/cancellation';
import { traceInfo, traceWarning } from '../../common/logger';
import { IFileSystem, TemporaryDirectory } from '../../common/platform/types';
import { IPythonExecutionFactory, SpawnOptions } from '../../common/process/types';
import { IDisposable, IOutputChannel } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { StopWatch } from '../../common/utils/stopWatch';
import { EXTENSION_ROOT_DIR } from '../../constants';
import { IInterpreterService } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { sendTelemetryEvent } from '../../telemetry';
import { JUPYTER_OUTPUT_CHANNEL, JupyterCommands, PythonDaemonModule, Telemetry } from '../constants';
import { IConnection } from '../types';
import { JupyterCommandFinder } from './interpreter/jupyterCommandFinder';
import { JupyterConnection, JupyterServerInfo } from './jupyterConnection';

/**
 * Responsible for starting a notebook.
 * Separate class as theres quite a lot of work involved in starting a notebook.
 *
 * @export
 * @class NotebookStarter
 * @implements {Disposable}
 */
@injectable()
export class NotebookStarter implements Disposable {
    private readonly disposables: IDisposable[] = [];
    constructor(
        @inject(IPythonExecutionFactory) private readonly executionFactory: IPythonExecutionFactory,
        @inject(JupyterCommandFinder) private readonly commandFinder: JupyterCommandFinder,
        @inject(IFileSystem) private readonly fileSystem: IFileSystem,
        @inject(IServiceContainer) private readonly serviceContainer: IServiceContainer,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IOutputChannel) @named(JUPYTER_OUTPUT_CHANNEL) private readonly jupyterOutputChannel: IOutputChannel
    ) {}
    public dispose() {
        while (this.disposables.length > 0) {
            const disposable = this.disposables.shift();
            try {
                if (disposable) {
                    disposable.dispose();
                }
            } catch {
                // Nohting
            }
        }
    }
    // tslint:disable-next-line: max-func-body-length
    public async start(useDefaultConfig: boolean, cancelToken?: CancellationToken): Promise<IConnection> {
        traceInfo('Starting Notebook');
        const notebookCommandPromise = this.commandFinder.findBestCommand(JupyterCommands.NotebookCommand);
        // Now actually launch it
        let exitCode: number | null = 0;
        try {
            // Generate a temp dir with a unique GUID, both to match up our started server and to easily clean up after
            const tempDirPromise = this.generateTempDir();
            tempDirPromise.then(dir => this.disposables.push(dir)).ignoreErrors();
            // Before starting the notebook process, make sure we generate a kernel spec
            const [args, notebookCommand] = await Promise.all([this.generateArguments(useDefaultConfig, tempDirPromise), notebookCommandPromise]);

            // Make sure we haven't canceled already.
            if (cancelToken && cancelToken.isCancellationRequested) {
                throw new CancellationError();
            }

            // Then use this to launch our notebook process.
            traceInfo('Starting Jupyter Notebook');
            const stopWatch = new StopWatch();
            const [launchResult, tempDir] = await Promise.all([
                notebookCommand!.command!.execObservable(args || [], { throwOnStdErr: false, encoding: 'utf8', token: cancelToken }),
                tempDirPromise
            ]);

            // Watch for premature exits
            if (launchResult.proc) {
                launchResult.proc.on('exit', (c: number | null) => (exitCode = c));
                launchResult.out.subscribe(out => this.jupyterOutputChannel.append(out.out));
            }

            // Make sure this process gets cleaned up. We might be canceled before the connection finishes.
            if (launchResult && cancelToken) {
                cancelToken.onCancellationRequested(() => {
                    launchResult.dispose();
                });
            }

            // Wait for the connection information on this result
            traceInfo('Waiting for Jupyter Notebook');
            const connection = await JupyterConnection.waitForConnection(tempDir.path, this.getJupyterServerInfo, launchResult, this.serviceContainer, cancelToken);

            // Fire off telemetry for the process being talkable
            sendTelemetryEvent(Telemetry.StartJupyterProcess, stopWatch.elapsedTime);

            return connection;
        } catch (err) {
            if (err instanceof CancellationError) {
                throw err;
            }

            // Something else went wrong. See if the local proc died or not.
            if (exitCode !== 0) {
                throw new Error(localize.DataScience.jupyterServerCrashed().format(exitCode.toString()));
            } else {
                throw new Error(localize.DataScience.jupyterNotebookFailure().format(err));
            }
        }
    }

    private async generateArguments(useDefaultConfig: boolean, tempDirPromise: Promise<TemporaryDirectory>): Promise<string[]> {
        // Parallelize as much as possible.
        const promisedArgs: Promise<string>[] = [];
        promisedArgs.push(Promise.resolve('--no-browser'));
        promisedArgs.push(this.getNotebookDirArgument(tempDirPromise));
        if (useDefaultConfig) {
            promisedArgs.push(this.getConfigArgument(tempDirPromise));
        }
        // Modify the data rate limit if starting locally. The default prevents large dataframes from being returned.
        promisedArgs.push(Promise.resolve('--NotebookApp.iopub_data_rate_limit=10000000000.0'));

        const [args, dockerArgs] = await Promise.all([Promise.all(promisedArgs), this.getDockerArguments()]);

        // Check for the debug environment variable being set. Setting this
        // causes Jupyter to output a lot more information about what it's doing
        // under the covers and can be used to investigate problems with Jupyter.
        const debugArgs = process.env && process.env.VSCODE_PYTHON_DEBUG_JUPYTER ? ['--debug'] : [];

        // Use this temp file and config file to generate a list of args for our command
        return [...args, ...dockerArgs, ...debugArgs];
    }

    /**
     * Gets the `--notebook-dir` argument.
     *
     * @private
     * @param {Promise<TemporaryDirectory>} tempDirectory
     * @returns {Promise<void>}
     * @memberof NotebookStarter
     */
    private async getNotebookDirArgument(tempDirectory: Promise<TemporaryDirectory>): Promise<string> {
        const tempDir = await tempDirectory;
        return `--notebook-dir=${tempDir.path}`;
    }

    /**
     * Gets the `--config` argument.
     *
     * @private
     * @param {Promise<TemporaryDirectory>} tempDirectory
     * @returns {Promise<void>}
     * @memberof NotebookStarter
     */
    private async getConfigArgument(tempDirectory: Promise<TemporaryDirectory>): Promise<string> {
        const tempDir = await tempDirectory;
        // In the temp dir, create an empty config python file. This is the same
        // as starting jupyter with all of the defaults.
        const configFile = path.join(tempDir.path, 'jupyter_notebook_config.py');
        await this.fileSystem.writeFile(configFile, '');
        traceInfo(`Generating custom default config at ${configFile}`);

        // Create extra args based on if we have a config or not
        return `--config=${configFile}`;
    }

    /**
     * Adds the `--ip` and `--allow-root` arguments when in docker.
     *
     * @private
     * @param {Promise<TemporaryDirectory>} tempDirectory
     * @returns {Promise<string[]>}
     * @memberof NotebookStarter
     */
    private async getDockerArguments(): Promise<string[]> {
        const args: string[] = [];
        // Check for a docker situation.
        try {
            const cgroup = await this.fileSystem.readFile('/proc/self/cgroup').catch(() => '');
            if (!cgroup.includes('docker')) {
                return args;
            }
            // We definitely need an ip address.
            args.push('--ip');
            args.push('127.0.0.1');

            // Now see if we need --allow-root.
            return new Promise(resolve => {
                cp.exec('id', { encoding: 'utf-8' }, (_, stdout: string | Buffer) => {
                    if (stdout && stdout.toString().includes('(root)')) {
                        args.push('--allow-root');
                    }
                    resolve(args);
                });
            });
        } catch {
            return args;
        }
    }
    private async generateTempDir(): Promise<TemporaryDirectory> {
        const resultDir = path.join(os.tmpdir(), uuid());
        await this.fileSystem.createDirectory(resultDir);

        return {
            path: resultDir,
            dispose: async () => {
                // Try ten times. Process may still be up and running.
                // We don't want to do async as async dispose means it may never finish and then we don't
                // delete
                let count = 0;
                while (count < 10) {
                    try {
                        await this.fileSystem.deleteDirectory(resultDir);
                        count = 10;
                    } catch {
                        count += 1;
                    }
                }
            }
        };
    }
    private getJupyterServerInfo = async (cancelToken?: CancellationToken): Promise<JupyterServerInfo[] | undefined> => {
        const notebookCommand = await this.commandFinder.findBestCommand(JupyterCommands.NotebookCommand);
        if (!notebookCommand.command) {
            return;
        }
        const [interpreter, activeInterpreter] = await Promise.all([notebookCommand.command.interpreter(), this.interpreterService.getActiveInterpreter()]);
        if (!interpreter) {
            return;
        }
        // Create a daemon only when using the current interpreter.
        // We dont' want to create daemons for all interpreters.
        const isActiveInterpreter = activeInterpreter ? activeInterpreter.path === interpreter.path : false;
        const daemon = await (isActiveInterpreter
            ? this.executionFactory.createDaemon({ daemonModule: PythonDaemonModule, pythonPath: interpreter.path })
            : this.executionFactory.createActivatedEnvironment({ allowEnvironmentFetchExceptions: true, interpreter, bypassCondaExecution: true }));
        // We have a small python file here that we will execute to get the server info from all running Jupyter instances
        const newOptions: SpawnOptions = { mergeStdOutErr: true, token: cancelToken };
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
    };
}
