// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import type { nbformat } from '@jupyterlab/coreutils';
import { inject, injectable, named } from 'inversify';
import * as path from 'path';
import * as uuid from 'uuid/v4';
import { DebugConfiguration, Disposable } from 'vscode';
import * as vsls from 'vsls/vscode';
import { concatMultilineStringOutput } from '../../../datascience-ui/common';
import { ServerStatus } from '../../../datascience-ui/interactive-common/mainState';
import { IApplicationShell } from '../../common/application/types';
import { traceError, traceInfo, traceWarning } from '../../common/logger';
import { IPlatformService } from '../../common/platform/types';
import { IConfigurationService, Version } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { EXTENSION_ROOT_DIR } from '../../constants';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { traceCellResults } from '../common';
import { Identifiers, Telemetry } from '../constants';
import {
    CellState,
    ICell,
    ICellHashListener,
    IFileHashes,
    IJupyterConnection,
    IJupyterDebugger,
    IJupyterDebugService,
    INotebook,
    ISourceMapRequest
} from '../types';
import { JupyterDebuggerNotInstalledError } from './jupyterDebuggerNotInstalledError';
import { JupyterDebuggerRemoteNotSupported } from './jupyterDebuggerRemoteNotSupported';
import { ILiveShareHasRole } from './liveshare/types';

const pythonShellCommand = `_sysexec = sys.executable\r\n_quoted_sysexec = '"' + _sysexec + '"'\r\n!{_quoted_sysexec}`;

@injectable()
export class JupyterDebugger implements IJupyterDebugger, ICellHashListener {
    private requiredDebugpyVersion: Version = { major: 1, minor: 0, patch: 0, build: [], prerelease: [], raw: '' };
    private configs: Map<string, DebugConfiguration> = new Map<string, DebugConfiguration>();
    private readonly debuggerPackage: string;
    private readonly enableDebuggerCode: string;
    private readonly waitForDebugClientCode: string;
    private readonly tracingEnableCode: string;
    private readonly tracingDisableCode: string;
    constructor(
        @inject(IApplicationShell) private appShell: IApplicationShell,
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(IJupyterDebugService)
        @named(Identifiers.MULTIPLEXING_DEBUGSERVICE)
        private debugService: IJupyterDebugService,
        @inject(IPlatformService) private platform: IPlatformService
    ) {
        this.debuggerPackage = 'debugpy';
        this.enableDebuggerCode = `import debugpy;debugpy.listen(('localhost', 0))`;
        this.waitForDebugClientCode = `import debugpy;debugpy.wait_for_client()`;
        this.tracingEnableCode = `from debugpy import trace_this_thread;trace_this_thread(True)`;
        this.tracingDisableCode = `from debugpy import trace_this_thread;trace_this_thread(False)`;
    }

    public startRunByLine(notebook: INotebook, cellHashFileName: string): Promise<void> {
        traceInfo(`Running by line for ${cellHashFileName}`);
        const config: Partial<DebugConfiguration> = {
            justMyCode: false,
            rules: [
                {
                    include: false,
                    path: '**/*'
                },
                {
                    include: true,
                    path: cellHashFileName
                }
            ]
        };
        return this.startDebugSession((c) => this.debugService.startRunByLine(c), notebook, config, true);
    }

    public async startDebugging(notebook: INotebook): Promise<void> {
        const settings = this.configService.getSettings(notebook.resource);
        return this.startDebugSession(
            (c) => this.debugService.startDebugging(undefined, c),
            notebook,
            {
                justMyCode: settings.datascience.debugJustMyCode
            },
            false
        );
    }

    public async stopDebugging(notebook: INotebook): Promise<void> {
        const config = this.configs.get(notebook.identity.toString());
        if (config) {
            traceInfo('stop debugging');

            // Tell our debug service to shutdown if possible
            this.debugService.stop();

            // Disable tracing after we disconnect because we don't want to step through this
            // code if the user was in step mode.
            if (notebook.status !== ServerStatus.Dead && notebook.status !== ServerStatus.NotStarted) {
                await this.executeSilently(notebook, this.tracingDisableCode);
            }
        }
    }

    public onRestart(notebook: INotebook): void {
        this.configs.delete(notebook.identity.toString());
    }

    public async hashesUpdated(hashes: IFileHashes[]): Promise<void> {
        // Make sure that we have an active debugging session at this point
        if (this.debugService.activeDebugSession) {
            await Promise.all(
                hashes.map((fileHash) => {
                    return this.debugService.activeDebugSession!.customRequest(
                        'setPydevdSourceMap',
                        this.buildSourceMap(fileHash)
                    );
                })
            );
        }
    }

    private async startDebugSession(
        startCommand: (config: DebugConfiguration) => Thenable<boolean>,
        notebook: INotebook,
        extraConfig: Partial<DebugConfiguration>,
        runByLine: boolean
    ) {
        traceInfo('start debugging');

        // Try to connect to this notebook
        const config = await this.connect(notebook, runByLine, extraConfig);
        if (config) {
            traceInfo('connected to notebook during debugging');

            // First check if this is a live share session. Skip debugging attach on the guest
            // tslint:disable-next-line: no-any
            const hasRole = (notebook as any) as ILiveShareHasRole;
            if (hasRole && hasRole.role && hasRole.role === vsls.Role.Guest) {
                traceInfo('guest mode attach skipped');
            } else {
                await startCommand(config);

                // Force the debugger to update its list of breakpoints. This is used
                // to make sure the breakpoint list is up to date when we do code file hashes
                this.debugService.removeBreakpoints([]);
            }

            // Wait for attach before we turn on tracing and allow the code to run, if the IDE is already attached this is just a no-op
            const importResults = await this.executeSilently(notebook, this.waitForDebugClientCode);
            if (importResults.length === 0 || importResults[0].state === CellState.error) {
                traceWarning(`${this.debuggerPackage} not found in path.`);
            } else {
                traceCellResults('import startup', importResults);
            }

            // Then enable tracing
            await this.executeSilently(notebook, this.tracingEnableCode);
        }
    }

    private async connect(
        notebook: INotebook,
        runByLine: boolean,
        extraConfig: Partial<DebugConfiguration>
    ): Promise<DebugConfiguration | undefined> {
        // If we already have configuration, we're already attached, don't do it again.
        const key = notebook.identity.toString();
        let result = this.configs.get(key);
        if (result) {
            return {
                ...result,
                ...extraConfig
            };
        }
        traceInfo('enable debugger attach');

        // Append any specific debugger paths that we have
        await this.appendDebuggerPaths(notebook);

        // Check the version of debugger that we have already installed
        const debuggerVersion = await this.debuggerCheck(notebook);
        const requiredVersion = this.requiredDebugpyVersion;

        // If we don't have debugger installed or the version is too old then we need to install it
        if (!debuggerVersion || !this.debuggerMeetsRequirement(debuggerVersion, requiredVersion)) {
            await this.promptToInstallDebugger(notebook, debuggerVersion, runByLine);
        }

        // Connect local or remote based on what type of notebook we're talking to
        result = {
            type: 'python',
            name: 'IPython',
            request: 'attach',
            ...extraConfig
        };
        const connectionInfo = notebook.connection;
        if (connectionInfo && !connectionInfo.localLaunch) {
            const { host, port } = await this.connectToRemote(notebook, connectionInfo);
            result.host = host;
            result.port = port;
        } else {
            const { host, port } = await this.connectToLocal(notebook);
            result.host = host;
            result.port = port;
        }

        if (result.port) {
            this.configs.set(notebook.identity.toString(), result);

            // Sign up for any change to the kernel to delete this config.
            const disposables: Disposable[] = [];
            const clear = () => {
                this.configs.delete(key);
                disposables.forEach((d) => d.dispose());
            };
            disposables.push(notebook.onDisposed(clear));
            disposables.push(notebook.onKernelRestarted(clear));
            disposables.push(notebook.onKernelChanged(clear));
        }

        return result;
    }

    /**
     * Gets the path to debugger.
     * Temporary hack to check if python >= 3.7 and if experiments is enabled, then use new debugger, else old.
     * (temporary to hard-code and use these in here).
     * The old debugger will soon go away into oblivion...
     * @private
     * @param {INotebook} _notebook
     * @returns {Promise<string>}
     * @memberof JupyterDebugger
     */
    private async getDebuggerPath(_notebook: INotebook): Promise<string> {
        // We are here so this is NOT python 3.7, return debugger without wheels
        return path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'lib', 'python');
    }
    private async calculateDebuggerPathList(notebook: INotebook): Promise<string | undefined> {
        const extraPaths: string[] = [];

        // Add the settings path first as it takes precedence over the ptvsd extension path
        // tslint:disable-next-line:no-multiline-string
        let settingsPath = this.configService.getSettings(notebook.resource).datascience.debugpyDistPath;
        // Escape windows path chars so they end up in the source escaped
        if (settingsPath) {
            if (this.platform.isWindows) {
                settingsPath = settingsPath.replace(/\\/g, '\\\\');
            }

            extraPaths.push(settingsPath);
        }

        // For a local connection we also need will append on the path to the debugger
        // installed locally by the extension
        // Actually until this is resolved: https://github.com/microsoft/vscode-python/issues/7615, skip adding
        // this path.
        const connectionInfo = notebook.connection;
        if (connectionInfo && connectionInfo.localLaunch) {
            let localPath = await this.getDebuggerPath(notebook);
            if (this.platform.isWindows) {
                localPath = localPath.replace(/\\/g, '\\\\');
            }
            extraPaths.push(localPath);
        }

        if (extraPaths && extraPaths.length > 0) {
            return extraPaths.reduce((totalPath, currentPath) => {
                if (totalPath.length === 0) {
                    totalPath = `'${currentPath}'`;
                } else {
                    totalPath = `${totalPath}, '${currentPath}'`;
                }

                return totalPath;
            }, '');
        }

        return undefined;
    }

    // Append our local debugger path and debugger settings path to sys.path
    private async appendDebuggerPaths(notebook: INotebook): Promise<void> {
        const debuggerPathList = await this.calculateDebuggerPathList(notebook);

        if (debuggerPathList && debuggerPathList.length > 0) {
            const result = await this.executeSilently(
                notebook,
                `import sys\r\nsys.path.extend([${debuggerPathList}])\r\nsys.path`
            );
            traceCellResults('Appending paths', result);
        }
    }

    private buildSourceMap(fileHash: IFileHashes): ISourceMapRequest {
        const sourceMapRequest: ISourceMapRequest = { source: { path: fileHash.file }, pydevdSourceMaps: [] };

        sourceMapRequest.pydevdSourceMaps = fileHash.hashes.map((cellHash) => {
            return {
                line: cellHash.line,
                endLine: cellHash.endLine,
                runtimeSource: { path: `<ipython-input-${cellHash.executionCount}-${cellHash.hash}>` },
                runtimeLine: cellHash.runtimeLine
            };
        });

        return sourceMapRequest;
    }

    private executeSilently(notebook: INotebook, code: string): Promise<ICell[]> {
        return notebook.execute(code, Identifiers.EmptyFileName, 0, uuid(), undefined, true);
    }

    private async debuggerCheck(notebook: INotebook): Promise<Version | undefined> {
        // We don't want to actually import the debugger to check version so run
        // python instead. If we import an old version it's hard to get rid of on
        // an 'upgrade needed' scenario
        // tslint:disable-next-line:no-multiline-string
        const debuggerPathList = await this.calculateDebuggerPathList(notebook);

        let code;
        if (debuggerPathList) {
            code = `import sys\r\n${pythonShellCommand} -c "import sys;sys.path.extend([${debuggerPathList}]);sys.path;import ${this.debuggerPackage};print(${this.debuggerPackage}.__version__)"`;
        } else {
            code = `import sys\r\n${pythonShellCommand} -c "import ${this.debuggerPackage};print(${this.debuggerPackage}.__version__)"`;
        }

        const debuggerVersionResults = await this.executeSilently(notebook, code);
        const purpose = 'parseDebugpyVersionInfo';
        return this.parseVersionInfo(debuggerVersionResults, purpose);
    }

    private parseVersionInfo(
        cells: ICell[],
        purpose: 'parseDebugpyVersionInfo' | 'pythonVersionInfo'
    ): Version | undefined {
        if (cells.length < 1 || cells[0].state !== CellState.finished) {
            traceCellResults(purpose, cells);
            return undefined;
        }

        const targetCell = cells[0];

        const outputString = this.extractOutput(targetCell);

        if (outputString) {
            // Pull out the version number, note that we can't use SemVer here as python packages don't follow it
            const packageVersionRegex = /([0-9]+).([0-9]+).([0-9a-zA-Z]+)/;
            const packageVersionMatch = packageVersionRegex.exec(outputString);

            if (packageVersionMatch) {
                const major = parseInt(packageVersionMatch[1], 10);
                const minor = parseInt(packageVersionMatch[2], 10);
                const patch = parseInt(packageVersionMatch[3], 10);
                return {
                    major,
                    minor,
                    patch,
                    build: [],
                    prerelease: [],
                    raw: `${major}.${minor}.${patch}`
                };
            }
        }

        traceCellResults(purpose, cells);

        return undefined;
    }

    // Check to see if the we have the required version of debugger to support debugging
    private debuggerMeetsRequirement(version: Version, required: Version): boolean {
        return version.major > required.major || (version.major === required.major && version.minor >= required.minor);
    }

    @captureTelemetry(Telemetry.DebugpyPromptToInstall)
    private async promptToInstallDebugger(
        notebook: INotebook,
        oldVersion: Version | undefined,
        runByLine: boolean
    ): Promise<void> {
        const updateMessage = runByLine
            ? localize.DataScience.jupyterDebuggerInstallUpdateRunByLine().format(this.debuggerPackage)
            : localize.DataScience.jupyterDebuggerInstallUpdate().format(this.debuggerPackage);
        const newMessage = runByLine
            ? localize.DataScience.jupyterDebuggerInstallNewRunByLine().format(this.debuggerPackage)
            : localize.DataScience.jupyterDebuggerInstallNew().format(this.debuggerPackage);
        const promptMessage = oldVersion ? updateMessage : newMessage;
        const result = await this.appShell.showInformationMessage(
            promptMessage,
            localize.DataScience.jupyterDebuggerInstallYes(),
            localize.DataScience.jupyterDebuggerInstallNo()
        );

        if (result === localize.DataScience.jupyterDebuggerInstallYes()) {
            await this.installDebugger(notebook);
        } else {
            // If they don't want to install, throw so we exit out of debugging
            sendTelemetryEvent(Telemetry.DebugpyInstallCancelled);
            throw new JupyterDebuggerNotInstalledError(this.debuggerPackage);
        }
    }

    private async installDebugger(notebook: INotebook): Promise<void> {
        // tslint:disable-next-line:no-multiline-string
        const debuggerInstallResults = await this.executeSilently(
            notebook,
            `import sys\r\n${pythonShellCommand} -m pip install -U ${this.debuggerPackage}`
        );
        traceInfo(`Installing ${this.debuggerPackage}`);

        if (debuggerInstallResults.length > 0) {
            const installResultsString = this.extractOutput(debuggerInstallResults[0]);

            if (installResultsString && installResultsString.includes('Successfully installed')) {
                sendTelemetryEvent(Telemetry.DebugpySuccessfullyInstalled);
                traceInfo(`${this.debuggerPackage} successfully installed`);
                return;
            }
        }
        traceCellResults(`Installing ${this.debuggerPackage}`, debuggerInstallResults);
        sendTelemetryEvent(Telemetry.DebugpyInstallFailed);
        traceError(`Failed to install ${this.debuggerPackage}`);
        // Failed to install debugger, throw to exit debugging
        throw new JupyterDebuggerNotInstalledError(this.debuggerPackage);
    }

    // Pull our connection info out from the cells returned by enable_attach
    private parseConnectInfo(cells: ICell[]): { port: number; host: string } {
        if (cells.length > 0) {
            let enableAttachString = this.extractOutput(cells[0]);
            if (enableAttachString) {
                enableAttachString = enableAttachString.trimQuotes();

                // Important: This regex matches the format of the string returned from enable_attach. When
                // doing enable_attach remotely, make sure to print out a string in the format ('host', port)
                const debugInfoRegEx = /\('(.*?)', ([0-9]*)\)/;
                const debugInfoMatch = debugInfoRegEx.exec(enableAttachString);
                if (debugInfoMatch) {
                    return {
                        port: parseInt(debugInfoMatch[2], 10),
                        host: debugInfoMatch[1]
                    };
                }
            }
        }
        // if we cannot parse the connect information, throw so we exit out of debugging
        if (cells[0]?.data) {
            const outputs = cells[0].data.outputs as nbformat.IOutput[];
            if (outputs[0]) {
                const error = outputs[0] as nbformat.IError;
                throw new JupyterDebuggerNotInstalledError(this.debuggerPackage, error.ename);
            }
        }
        throw new JupyterDebuggerNotInstalledError(
            localize.DataScience.jupyterDebuggerOutputParseError().format(this.debuggerPackage)
        );
    }

    private extractOutput(cell: ICell): string | undefined {
        if (cell.state === CellState.error || cell.state === CellState.finished) {
            const outputs = cell.data.outputs as nbformat.IOutput[];
            if (outputs.length > 0) {
                const data = outputs[0].data;
                if (data && data.hasOwnProperty('text/plain')) {
                    // tslint:disable-next-line:no-any
                    return (data as any)['text/plain'];
                }
                if (outputs[0].output_type === 'stream') {
                    const stream = outputs[0] as nbformat.IStream;
                    return concatMultilineStringOutput(stream.text);
                }
            }
        }
        return undefined;
    }

    private async connectToLocal(notebook: INotebook): Promise<{ port: number; host: string }> {
        const enableDebuggerResults = await this.executeSilently(notebook, this.enableDebuggerCode);

        // Save our connection info to this notebook
        return this.parseConnectInfo(enableDebuggerResults);
    }

    private async connectToRemote(
        _notebook: INotebook,
        _connectionInfo: IJupyterConnection
    ): Promise<{ port: number; host: string }> {
        // We actually need a token. This isn't supported at the moment
        throw new JupyterDebuggerRemoteNotSupported();

        //         let portNumber = this.configService.getSettings().datascience.remoteDebuggerPort;
        //         if (!portNumber) {
        //             portNumber = -1;
        //         }

        //         // Loop through a bunch of ports until we find one we can use. Note how we
        //         // are connecting to '0.0.0.0' here. That's the location as far as ptvsd is concerned.
        //         const attachCode = portNumber !== -1 ?
        //             `import ptvsd
        // ptvsd.enable_attach(('0.0.0.0', ${portNumber}))
        // print("('${connectionInfo.hostName}', ${portNumber})")` :
        //             // tslint:disable-next-line: no-multiline-string
        //             `import ptvsd
        // port = ${Settings.RemoteDebuggerPortBegin}
        // attached = False
        // while not attached and port <= ${Settings.RemoteDebuggerPortEnd}:
        //     try:
        //         ptvsd.enable_attach(('0.0.0.0', port))
        //         print("('${connectionInfo.hostName}', " + str(port) + ")")
        //         attached = True
        //     except Exception as e:
        //         print("Exception: " + str(e))
        //         port +=1`;
        //         const enableDebuggerResults = await this.executeSilently(server, attachCode);

        //         // Save our connection info to this server
        //         const result = this.parseConnectInfo(enableDebuggerResults, false);

        //         // If that didn't work, throw an error so somebody can open the port
        //         if (!result) {
        //             throw new JupyterDebuggerPortNotAvailableError(portNumber, Settings.RemoteDebuggerPortBegin, Settings.RemoteDebuggerPortEnd);
        //         }

        //         // Double check, open a socket? This won't work if we're remote ourselves. Actually the debug adapter runs
        //         // from the remote machine.
        //         try {
        //             const deferred = createDeferred();
        //             const socket = net.createConnection(result.port, result.host, () => {
        //                 deferred.resolve();
        //             });
        //             socket.on('error', (err) => deferred.reject(err));
        //             socket.setTimeout(2000, () => deferred.reject(new Error('Timeout trying to ping remote debugger')));
        //             await deferred.promise;
        //             socket.end();
        //         } catch (exc) {
        //             traceWarning(`Cannot connect to remote debugger at ${result.host}:${result.port} => ${exc}`);
        //             // We can't connect. Must be a firewall issue
        //             throw new JupyterDebuggerPortBlockedError(portNumber, Settings.RemoteDebuggerPortBegin, Settings.RemoteDebuggerPortEnd);
        //         }

        //         return result;
    }
}
