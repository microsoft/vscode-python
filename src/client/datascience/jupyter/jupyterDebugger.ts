// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { nbformat } from '@jupyterlab/coreutils';
import { inject, injectable } from 'inversify';
import * as net from 'net';
import * as uuid from 'uuid/v4';
import { DebugConfiguration } from 'vscode';
import * as vsls from 'vsls/vscode';

import { ICommandManager, IDebugService } from '../../common/application/types';
import { traceInfo, traceWarning } from '../../common/logger';
import { IPlatformService } from '../../common/platform/types';
import { IConfigurationService } from '../../common/types';
import { concatMultilineString } from '../common';
import { Identifiers } from '../constants';
import {
    CellState,
    ICell,
    ICellHashListener,
    IConnection,
    IDebuggerConnectInfo,
    IFileHashes,
    IJupyterDebugger,
    INotebookServer,
    ISourceMapRequest
} from '../types';
import { JupyterDebuggerNotInstalledError } from './jupyterDebuggerNotInstalledError';
import { JupyterDebuggerPortBlockedError } from './jupyterDebuggerPortBlockedError';
import { JupyterDebuggerPortNotAvailableError } from './jupyterDebuggerPortNotAvailableError';
import { ILiveShareParticipant } from './liveshare/types';

@injectable()
export class JupyterDebugger implements IJupyterDebugger, ICellHashListener {
    private connectInfoMap: Map<string, IDebuggerConnectInfo> = new Map<string, IDebuggerConnectInfo>();
    constructor(
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(ICommandManager) private commandManager: ICommandManager,
        @inject(IDebugService) private debugService: IDebugService,
        @inject(IPlatformService) private platform: IPlatformService
    ) {
    }

    public async startDebugging(server: INotebookServer): Promise<void> {
        traceInfo('start debugging');

        // Try to connect to this server
        const connectInfo = await this.connect(server);

        if (connectInfo) {
            // First connect the VSCode UI
            const config: DebugConfiguration = {
                name: 'IPython',
                request: 'attach',
                type: 'python',
                port: connectInfo.port,
                host: connectInfo.hostName,
                justMyCode: true
                // logToFile: true <-- This will log a debug log file to the extension root folder.
            };

            await this.debugService.startDebugging(undefined, config);

            // Force the debugger to update its list of breakpoints. This is used
            // to make sure the breakpoint list is up to date when we send our mappings.
            this.debugService.removeBreakpoints([]);

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
        const connectInfo = this.connectInfoMap.get(server.id);
        if (connectInfo) {
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
        this.connectInfoMap.delete(server.id);
    }

    public async hashesUpdated(hashes: IFileHashes[]): Promise<void> {
        // Make sure that we have an active debugging session at this point
        if (this.debugService.activeDebugSession) {
            await Promise.all(hashes.map((fileHash) => {
                return this.debugService.activeDebugSession!.customRequest('setPydevdSourceMap', this.buildSourceMap(fileHash));
            }));
        }
    }

    private async connect(server: INotebookServer): Promise<IDebuggerConnectInfo | undefined> {
        // First check if this is a live share server. Skip debugging attach on the guest
        // tslint:disable-next-line: no-any
        const liveShareParticipant = (server as any) as ILiveShareParticipant;
        if (liveShareParticipant && liveShareParticipant.role && liveShareParticipant.role === vsls.Role.Guest) {
            traceInfo('guest mode attach skipped');
            return;
        }

        // If we already have connection info, we're already attached, don't do it again.
        let result = this.connectInfoMap.get(server.id);
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
            this.connectInfoMap.set(server.id, result);
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
    private parseConnectInfo(cells: ICell[]): IDebuggerConnectInfo | undefined {
        if (cells.length > 0) {
            let enableAttachString = this.extractOutput(cells[0]);
            if (enableAttachString) {
                enableAttachString = enableAttachString.trimQuotes();

                const debugInfoRegEx = /\('(.*?)', ([0-9]*)\)/;

                const debugInfoMatch = debugInfoRegEx.exec(enableAttachString);
                if (debugInfoMatch) {
                    return { hostName: debugInfoMatch[1], port: parseInt(debugInfoMatch[2], 10) };
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

    private async connectToLocal(server: INotebookServer): Promise<IDebuggerConnectInfo | undefined> {
        // tslint:disable-next-line: no-multiline-string
        const enableDebuggerResults = await this.executeSilently(server, `ptvsd.enable_attach(('localhost', 0))`);

        // Save our connection info to this server
        return this.parseConnectInfo(enableDebuggerResults);
    }

    private async connectToRemote(server: INotebookServer, connectionInfo: IConnection): Promise<IDebuggerConnectInfo | undefined> {
        let portNumber = this.configService.getSettings().datascience.remoteDebuggerPort;
        if (!portNumber) {
            portNumber = -1;
        }

        // Loop through a bunch of ports until we find one we can use.
        const attachCode = portNumber !== -1 ?
            `ptvsd.enable_attach(('${connectionInfo.hostName}', ${portNumber}))` :
            // tslint:disable-next-line: no-multiline-string
            `port = 8889
attached = False
while not attached and port <= 9000:
    try:
        ptvsd.enable_attach(('${connectionInfo.hostName}', port))
        print("('${connectionInfo.hostName}', " + str(port) + ")")
        attached = True
    except Exception as e:
        port +=1`;
        const enableDebuggerResults = await this.executeSilently(server, attachCode);

        // Save our connection info to this server
        const result = this.parseConnectInfo(enableDebuggerResults);

        // If that didn't work, throw an error so somebody can open the port
        if (!result) {
            throw new JupyterDebuggerPortNotAvailableError(portNumber);
        }

        // Double check, open a socket? This won't work if we're remote ourselves. Actually the debug adapter runs
        // from the remote machine.
        try {
            const socket = net.createConnection(result.port, result.hostName);
            socket.end();
        } catch {
            // We can't connect. Must be a firewall issue
            throw new JupyterDebuggerPortBlockedError(portNumber);
        }

        return result;
    }
}
