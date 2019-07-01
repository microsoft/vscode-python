// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { nbformat } from '@jupyterlab/coreutils';
import { inject, injectable } from 'inversify';
import * as uuid from 'uuid/v4';
import { DebugConfiguration } from 'vscode';

import { ICommandManager, IDebugService } from '../../common/application/types';
import { traceInfo } from '../../common/logger';
import { Identifiers } from '../constants';
import { CellState, ICell, ICellHashProvider, IDebuggerConnectInfo, IFileHashes, IJupyterDebugger, INotebookServer, ISourceMapRequest } from '../types';

@injectable()
export class JupyterDebugger implements IJupyterDebugger {
    private connectInfo: IDebuggerConnectInfo | undefined;

    constructor(
            @inject(ICellHashProvider) private hashProvider: ICellHashProvider,
            @inject(ICommandManager) private commandManager: ICommandManager,
            @inject(IDebugService) private debugService: IDebugService
        ) {}

    public async enableAttach(server: INotebookServer): Promise<void> {
        traceInfo('enable debugger attach');

        // Current version of ptvsd doesn't support returning the value that we need so you need to install the correct version or use my hardcoded line above
        // tslint:disable-next-line:no-multiline-string
        const enableDebuggerResults = await this.executeSilently(server, `import sys\r\nsys.path.append('d:/ptvsd-drop/kdrop/src')\r\nimport os\r\nos.environ["PTVSD_LOG_DIR"] = "d:/note_dbg/logs"\r\nimport ptvsd\r\nptvsd.enable_attach(('localhost', 0))`);
        // tslint:disable-next-line:no-multiline-string
        //const enableDebuggerResults = await this.executeSilently(server, `import ptvsd\r\nptvsd.enable_attach(('localhost', 0))`);

        // Save our connection info to this server
        this.connectInfo = this.parseConnectInfo(enableDebuggerResults);
    }

    public async startDebugging(server: INotebookServer): Promise<void> {
        traceInfo('start debugging');

        if (this.connectInfo) {
            // First connect the VSCode UI
            const config: DebugConfiguration = {
                name: 'IPython',
                request: 'attach',
                type: 'python',
                port: this.connectInfo.port,
                host: this.connectInfo.hostName
            };

            await this.debugService.startDebugging(undefined, config);

            // Wait for attach before we turn on tracing and allow the code to run, if the IDE is already attached this is just a no-op
            // tslint:disable-next-line:no-multiline-string
            await this.executeSilently(server, `import ptvsd\r\nptvsd.wait_for_attach()`);

            // Then enable tracing
            // tslint:disable-next-line:no-multiline-string
            await this.executeSilently(server, `from ptvsd import tracing\r\ntracing(True)`);

            // Send our initial set of file mappings
            await this.updateDebuggerSourceMaps();
        }
    }

    public async stopDebugging(server: INotebookServer): Promise<void> {
        traceInfo('stop debugging');
        // Disable tracing
        // tslint:disable-next-line:no-multiline-string
        await this.executeSilently(server, `from ptvsd import tracing\r\ntracing(False)`);

        // Stop our debugging UI session, no await as we just want it stopped
        this.commandManager.executeCommand('workbench.action.debug.stop');
    }

    private async updateDebuggerSourceMaps(): Promise<void> {
        // Make sure that we have an active debugging session at this point
        if (this.debugService.activeDebugSession) {
            const fileHashes = this.hashProvider.getHashes();

            fileHashes.forEach(async (fileHash) => {
                // IANHU: Check bad results from this call?
                // At this point according to the log / Karthik this should already be executed, but the responce here is not SetPydevdSourceMapResponse as expected
                // ! here as we have already validated activeDebugSession
                const results = await this.debugService.activeDebugSession!.customRequest('setPydevdSourceMap', this.buildSourceMap(fileHash));
            });
        }
    }

    private buildSourceMap(fileHash: IFileHashes): ISourceMapRequest {
        const sourceMapRequest: ISourceMapRequest = { source: { path: fileHash.file }, pydevdSourceMaps: [] };

        sourceMapRequest.pydevdSourceMaps = fileHash.hashes.map(cellHash => {
            return {
                line: cellHash.line,
                endLine: cellHash.endLine,
                runtimeSource: { path: `<ipython-input-${cellHash.executionCount}-${cellHash.hash}>`},
                runtimeLine: 1
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
            }
        }
        return undefined;
    }
}
