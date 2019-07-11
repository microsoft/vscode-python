// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { nbformat } from '@jupyterlab/coreutils';
import { inject, injectable } from 'inversify';
import * as net from 'net';
import * as uuid from 'uuid/v4';
import { DebugConfiguration } from 'vscode';
import * as vsls from 'vsls/vscode';

import { ICommandManager, IDebugService, IWorkspaceService } from '../../common/application/types';
import { traceInfo, traceWarning } from '../../common/logger';
import { IPlatformService } from '../../common/platform/types';
import { IConfigurationService } from '../../common/types';
import { createDeferred } from '../../common/utils/async';
import { concatMultilineString } from '../common';
import { Identifiers, Settings } from '../constants';
import {
    CellState,
    ICell,
    ICellHashListener,
    IConnection,
    IFileHashes,
    IJupyterDebugger,
    INotebookServer,
    ISourceMapRequest
} from '../types';
import { JupyterDebuggerNotInstalledError } from './jupyterDebuggerNotInstalledError';
import { JupyterDebuggerPortBlockedError } from './jupyterDebuggerPortBlockedError';
import { JupyterDebuggerPortNotAvailableError } from './jupyterDebuggerPortNotAvailableError';
import { ILiveShareHasRole } from './liveshare/types';

@injectable()
export class JupyterDebugger implements IJupyterDebugger, ICellHashListener {
    private configs: Map<string, DebugConfiguration> = new Map<string, DebugConfiguration>();
    constructor(
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(ICommandManager) private commandManager: ICommandManager,
        @inject(IDebugService) private debugService: IDebugService,
        @inject(IPlatformService) private platform: IPlatformService,
        @inject(IWorkspaceService) private workspace: IWorkspaceService
    ) {
    }

    public async startDebugging(server: INotebookServer): Promise<void> {
        traceInfo('start debugging');

        // Try to connect to this server
        const config = await this.connect(server);

        if (config) {
            // First check if this is a live share session. Skip debugging attach on the guest
            // tslint:disable-next-line: no-any
            const hasRole = (server as any) as ILiveShareHasRole;
            if (hasRole && hasRole.role && hasRole.role === vsls.Role.Guest) {
                traceInfo('guest mode attach skipped');
            } else {
                await this.debugService.startDebugging(undefined, config);

                // Force the debugger to update its list of breakpoints. This is used
                // to make sure the breakpoint list is up to date when we do code file hashes
                this.debugService.removeBreakpoints([]);
            }

            // Wait for attach before we turn on tracing and allow the code to run, if the IDE is already attached this is just a no-op
            // tslint:disable-next-line:no-multiline-string
            const importResults = await this.executeSilently(server, `import ptvsd\nptvsd.wait_for_attach()`);
            if (importResults.length === 0 || importResults[0].state === CellState.error) {
                traceWarning('PTVSD not found in path.');
            }

            // Then enable tracing
            // tslint:disable-next-line:no-multiline-string
            await this.executeSilently(server, `from ptvsd import tracing\ntracing(True)`);
        }
    }

    public async stopDebugging(server: INotebookServer): Promise<void> {
        const config = this.configs.get(server.id);
        if (config) {
            traceInfo('stop debugging');

            // Stop our debugging UI session, no await as we just want it stopped
            this.commandManager.executeCommand('workbench.action.debug.stop');

            // Disable tracing after we disconnect because we don't want to step through this
            // code if the user was in step mode.
            // tslint:disable-next-line:no-multiline-string
            await this.executeSilently(server, `from ptvsd import tracing\ntracing(False)`);
        }
    }

    public onRestart(server: INotebookServer): void {
        this.configs.delete(server.id);
    }

    public async hashesUpdated(hashes: IFileHashes[]): Promise<void> {
        // Make sure that we have an active debugging session at this point
        if (this.debugService.activeDebugSession) {
            await Promise.all(hashes.map((fileHash) => {
                return this.debugService.activeDebugSession!.customRequest('setPydevdSourceMap', this.buildSourceMap(fileHash));
            }));
        }
    }

    private async connect(server: INotebookServer): Promise<DebugConfiguration | undefined> {
        // If we already have configuration, we're already attached, don't do it again.
        let result = this.configs.get(server.id);
        if (result) {
            return result;
        }
        traceInfo('enable debugger attach');

        // Current version of ptvsd doesn't support the source map entries, so we need to have a custom copy
        // on disk somewhere. Append this location to our sys path.
        // tslint:disable-next-line:no-multiline-string
        let extraPath = this.configService.getSettings().datascience.ptvsdDistPath;
        // Escape windows path chars so they end up in the source escaped
        if (this.platform.isWindows && extraPath) {
            extraPath = extraPath.replace('\\', '\\\\');
        }
        if (extraPath) {
            traceInfo(`Adding path for ptvsd - ${extraPath}`);
            await this.executeSilently(server, `import sys\r\nsys.path.append('${extraPath}')\r\nsys.path`);
        }

        // Make sure we can use ptvsd
        const importResults = await this.executeSilently(server, 'import ptvsd');
        if (importResults && importResults.length > 0) {
            if (importResults[0].state === CellState.error) {
                throw new JupyterDebuggerNotInstalledError();
            }
        }

        // Connect local or remote based on what type of server we're talking to
        const connectionInfo = server.getConnectionInfo();
        if (connectionInfo && !connectionInfo.localLaunch) {
            result = await this.connectToRemote(server, connectionInfo);
        } else {
            result = await this.connectToLocal(server);
        }

        if (result) {
            this.configs.set(server.id, result);
        }

        return result;
    }

    private buildSourceMap(fileHash: IFileHashes): ISourceMapRequest {
        const sourceMapRequest: ISourceMapRequest = { source: { path: fileHash.file }, pydevdSourceMaps: [] };

        sourceMapRequest.pydevdSourceMaps = fileHash.hashes.map(cellHash => {
            return {
                line: cellHash.line,
                endLine: cellHash.endLine,
                runtimeSource: { path: `<ipython-input-${cellHash.executionCount}-${cellHash.hash}>` },
                runtimeLine: cellHash.runtimeLine
            };
        });

        return sourceMapRequest;
    }

    private executeSilently(server: INotebookServer, code: string): Promise<ICell[]> {
        return server.execute(code, Identifiers.EmptyFileName, 0, uuid(), undefined, true);
    }

    // Pull our connection info out from the cells returned by enable_attach
    private parseConnectInfo(cells: ICell[], local: boolean): DebugConfiguration | undefined {
        if (cells.length > 0) {
            let enableAttachString = this.extractOutput(cells[0]);
            if (enableAttachString) {
                enableAttachString = enableAttachString.trimQuotes();

                // Important: This regex matches the format of the string returned from enable_attach. When
                // doing enable_attach remotely, make sure to print out a string in the format ('host', port)
                const debugInfoRegEx = /\('(.*?)', ([0-9]*)\)/;

                const debugInfoMatch = debugInfoRegEx.exec(enableAttachString);
                if (debugInfoMatch) {
                    const localConfig: DebugConfiguration = {
                        name: 'IPython',
                        request: 'attach',
                        type: 'python',
                        port: parseInt(debugInfoMatch[2], 10),
                        host: debugInfoMatch[1],
                        justMyCode: true
                    };
                    if (local) {
                        return localConfig;
                    } else {
                        return {
                            ...localConfig,
                            pathMappings: [
                                {
                                    localRoot: this.workspace.rootPath,
                                    remoteRoot: '.'
                                }
                            ]
                        };
                    }
                }
            }
        }
        return undefined;
    }

    private extractOutput(cell: ICell): string | undefined {
        if (cell.state === CellState.error || cell.state === CellState.finished) {
            const outputs = cell.data.outputs as nbformat.IOutput[];
            if (outputs.length > 0) {
                const data = outputs[0].data;
                if (data && data.hasOwnProperty('text/plain')) {
                    // tslint:disable-next-line:no-any
                    return ((data as any)['text/plain']);
                }
                if (outputs[0].output_type === 'stream') {
                    const stream = outputs[0] as nbformat.IStream;
                    return concatMultilineString(stream.text);
                }
            }
        }
        return undefined;
    }

    private async connectToLocal(server: INotebookServer): Promise<DebugConfiguration | undefined> {
        // tslint:disable-next-line: no-multiline-string
        const enableDebuggerResults = await this.executeSilently(server, `ptvsd.enable_attach(('localhost', 0))`);

        // Save our connection info to this server
        return this.parseConnectInfo(enableDebuggerResults, true);
    }

    private async connectToRemote(server: INotebookServer, connectionInfo: IConnection): Promise<DebugConfiguration | undefined> {
        let portNumber = this.configService.getSettings().datascience.remoteDebuggerPort;
        if (!portNumber) {
            portNumber = -1;
        }

        // Loop through a bunch of ports until we find one we can use. Note how we
        // are connecting to '0.0.0.0' here. That's the location as far as ptvsd is concerned.
        const attachCode = portNumber !== -1 ?
            `ptvsd.enable_attach(('0.0.0.0', ${portNumber}))
print("('${connectionInfo.hostName}', ${portNumber})")` :
            // tslint:disable-next-line: no-multiline-string
            `port = ${Settings.RemoteDebuggerPortBegin}
attached = False
while not attached and port <= ${Settings.RemoteDebuggerPortEnd}:
    try:
        ptvsd.enable_attach(('0.0.0.0', port))
        print("('${connectionInfo.hostName}', " + str(port) + ")")
        attached = True
    except Exception as e:
        print("Exception: " + str(e))
        port +=1`;
        const enableDebuggerResults = await this.executeSilently(server, attachCode);

        // Save our connection info to this server
        const result = this.parseConnectInfo(enableDebuggerResults, false);

        // If that didn't work, throw an error so somebody can open the port
        if (!result) {
            throw new JupyterDebuggerPortNotAvailableError(portNumber, Settings.RemoteDebuggerPortBegin, Settings.RemoteDebuggerPortEnd);
        }

        // Double check, open a socket? This won't work if we're remote ourselves. Actually the debug adapter runs
        // from the remote machine.
        try {
            const deferred = createDeferred();
            const socket = net.createConnection(result.port, result.host, () => {
                deferred.resolve();
            });
            socket.on('error', (err) => deferred.reject(err));
            socket.setTimeout(2000, () => deferred.reject(new Error('Timeout trying to ping remote debugger')));
            await deferred.promise;
            socket.end();
        } catch (exc) {
            traceWarning(`Cannot connect to remote debugger at ${result.host}:${result.port} => ${exc}`);
            // We can't connect. Must be a firewall issue
            throw new JupyterDebuggerPortBlockedError(portNumber, Settings.RemoteDebuggerPortBegin, Settings.RemoteDebuggerPortEnd);
        }

        return result;
    }
}
