// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { execSync } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import * as uuid from 'uuid/v4';
import { CancellationToken, Disposable } from 'vscode';
import { CancellationError } from '../../common/cancellation';
import { traceInfo } from '../../common/logger';
import { IFileSystem, TemporaryDirectory } from '../../common/platform/types';
import { IPythonExecutionFactory, SpawnOptions } from '../../common/process/types';
import { IDisposable } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { StopWatch } from '../../common/utils/stopWatch';
import { EXTENSION_ROOT_DIR } from '../../constants';
import { IServiceContainer } from '../../ioc/types';
import { sendTelemetryEvent } from '../../telemetry';
import { JupyterCommands, Telemetry } from '../constants';
import { IConnection, IJupyterExecution, IJupyterKernelSpec } from '../types';
import { JupyterCommandFinder } from './jupyterCommandFinder';
import { JupyterConnection, JupyterServerInfo } from './jupyterConnection';
import { KernelService } from './kernelService';

/**
 * Responsible for starting a notebook.
 * Separate class as theres quite a lot of work involved in starting a notebook.
 *
 * @export
 * @class NotebookStarter
 * @implements {Disposable}
 */
export class NotebookStarter implements Disposable {
    private readonly disposables: IDisposable[] = [];
    constructor(
        private readonly executionFactory: IPythonExecutionFactory,
        private readonly jupyterExecution: IJupyterExecution,
        private readonly commandFinder: JupyterCommandFinder,
        private readonly kernelService: KernelService,
        private readonly fileSystem: IFileSystem,
        private readonly serviceContainer: IServiceContainer
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
    public async start(useDefaultConfig: boolean, cancelToken?: CancellationToken): Promise<{ connection: IConnection; kernelSpec: IJupyterKernelSpec | undefined }> {
        const notebookCommand = await this.commandFinder.findBestCommand(JupyterCommands.NotebookCommand);
        // Now actually launch it
        let exitCode: number | null = 0;
        try {
            // Generate a temp dir with a unique GUID, both to match up our started server and to easily clean up after
            const tempDir = await this.generateTempDir();
            this.disposables.push(tempDir);

            // In the temp dir, create an empty config python file. This is the same
            // as starting jupyter with all of the defaults.
            const configFile = useDefaultConfig ? path.join(tempDir.path, 'jupyter_notebook_config.py') : undefined;
            if (configFile) {
                await this.fileSystem.writeFile(configFile, '');
                traceInfo(`Generating custom default config at ${configFile}`);
            }

            // Create extra args based on if we have a config or not
            const extraArgs: string[] = [];
            if (useDefaultConfig) {
                extraArgs.push(`--config=${configFile}`);
            }
            // Check for the debug environment variable being set. Setting this
            // causes Jupyter to output a lot more information about what it's doing
            // under the covers and can be used to investigate problems with Jupyter.
            if (process.env && process.env.VSCODE_PYTHON_DEBUG_JUPYTER) {
                extraArgs.push('--debug');
            }

            // Modify the data rate limit if starting locally. The default prevents large dataframes from being returned.
            extraArgs.push('--NotebookApp.iopub_data_rate_limit=10000000000.0');

            // Check for a docker situation.
            try {
                if (await this.fileSystem.fileExists('/proc/self/cgroup')) {
                    const cgroup = await this.fileSystem.readFile('/proc/self/cgroup');
                    if (cgroup.includes('docker')) {
                        // We definitely need an ip address.
                        extraArgs.push('--ip');
                        extraArgs.push('127.0.0.1');

                        // Now see if we need --allow-root.
                        const idResults = execSync('id', { encoding: 'utf-8' });
                        if (idResults.includes('(root)')) {
                            extraArgs.push('--allow-root');
                        }
                    }
                }
            } catch {
                noop();
            }

            // Use this temp file and config file to generate a list of args for our command
            const args: string[] = [...['--no-browser', `--notebook-dir=${tempDir.path}`], ...extraArgs];

            // Before starting the notebook process, make sure we generate a kernel spec
            const kernelSpec = await this.kernelService.getMatchingKernelSpec(undefined, cancelToken);

            // Make sure we haven't canceled already.
            if (cancelToken && cancelToken.isCancellationRequested) {
                throw new CancellationError();
            }

            // Then use this to launch our notebook process.
            const stopWatch = new StopWatch();
            const launchResult = await notebookCommand.command!.execObservable(args, { throwOnStdErr: false, encoding: 'utf8', token: cancelToken });

            // Watch for premature exits
            if (launchResult.proc) {
                launchResult.proc.on('exit', c => (exitCode = c));
            }

            // Make sure this process gets cleaned up. We might be canceled before the connection finishes.
            if (launchResult && cancelToken) {
                cancelToken.onCancellationRequested(() => {
                    launchResult.dispose();
                });
            }

            // Wait for the connection information on this result
            const connection = await JupyterConnection.waitForConnection(tempDir.path, this.getJupyterServerInfo, launchResult, this.serviceContainer, cancelToken);

            // Fire off telemetry for the process being talkable
            sendTelemetryEvent(Telemetry.StartJupyterProcess, stopWatch.elapsedTime);

            return {
                connection: connection,
                kernelSpec: kernelSpec
            };
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
        // We have a small python file here that we will execute to get the server info from all running Jupyter instances
        const bestInterpreter = await this.jupyterExecution.getUsableJupyterPython(cancelToken);
        if (bestInterpreter) {
            const newOptions: SpawnOptions = { mergeStdOutErr: true, token: cancelToken };
            const launcher = await this.executionFactory.createActivatedEnvironment({ resource: undefined, interpreter: bestInterpreter, allowEnvironmentFetchExceptions: true });
            const file = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'datascience', 'getServerInfo.py');
            const serverInfoString = await launcher.exec([file], newOptions);

            let serverInfos: JupyterServerInfo[];
            try {
                // Parse out our results, return undefined if we can't suss it out
                serverInfos = JSON.parse(serverInfoString.stdout.trim()) as JupyterServerInfo[];
            } catch (err) {
                return undefined;
            }
            return serverInfos;
        }

        return undefined;
    }
}
