// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { nbformat } from '@jupyterlab/coreutils';
import { inject, injectable } from 'inversify';
import * as uuid from 'uuid/v4';
import { DebugConfiguration, DebugSessionCustomEvent } from 'vscode';

import { ICommandManager, IDebugService } from '../../common/application/types';
import { traceInfo } from '../../common/logger';
import { IConfigurationService } from '../../common/types';
import { Deferred } from '../../common/utils/async';
import { Identifiers } from '../constants';
import {
    CellState,
    ICell,
    ICellHashProvider,
    IDebuggerConnectInfo,
    IFileHashes,
    IJupyterDebugger,
    INotebookServer,
    ISourceMapRequest
} from '../types';

@injectable()
export class JupyterDebugger implements IJupyterDebugger {
    private connectInfo: IDebuggerConnectInfo | undefined;
    private pendingSourceMapRequest : Deferred<void> | undefined;
    private pendingSourceMapResponseCount: number = 0;

    constructor(
            @inject(IConfigurationService) private configService: IConfigurationService,
            @inject(ICellHashProvider) private hashProvider: ICellHashProvider,
            @inject(ICommandManager) private commandManager: ICommandManager,
            @inject(IDebugService) private debugService: IDebugService
        ) {
        this.debugService.onDidReceiveDebugSessionCustomEvent(this.onCustomEvent.bind(this));
    }

    public async enableAttach(server: INotebookServer): Promise<void> {
        traceInfo('enable debugger attach');

        // Current version of ptvsd doesn't support the source map entries, so we need to have a custom copy
        // on disk somewhere. Append this location to our sys path.
        // tslint:disable-next-line:no-multiline-string
        await this.executeSilently(server, `import sys\r\nsys.path.append('${this.configService.getSettings().datascience.ptvsdDistPath}')`);
        // tslint:disable-next-line:no-multiline-string
        const enableDebuggerResults = await this.executeSilently(server, `import ptvsd\r\nptvsd.enable_attach(('localhost', 0))`);

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
                host: this.connectInfo.hostName,
                justMyCode: true
            };

            await this.debugService.startDebugging(undefined, config);

            // Wait for attach before we turn on tracing and allow the code to run, if the IDE is already attached this is just a no-op
            // tslint:disable-next-line:no-multiline-string
            await this.executeSilently(server, `import ptvsd\r\nptvsd.wait_for_attach()`);

            // Send our initial set of file mappings
            await this.updateDebuggerSourceMaps();

            // Then enable tracing
            // tslint:disable-next-line:no-multiline-string
            await this.executeSilently(server, `from ptvsd import tracing\r\ntracing(True)`);
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

    private onCustomEvent(e: DebugSessionCustomEvent) {
        // See if we're waiting for the source map event to finish or not
        if (this.pendingSourceMapRequest) {
            switch (e.event){
                case 'setPydevdSourceMapResponse':
                    this.pendingSourceMapResponseCount = Math.max(0, this.pendingSourceMapResponseCount - 1);
                    if (this.pendingSourceMapResponseCount === 0) {
                        this.pendingSourceMapRequest.resolve();
                    }
                    break;

                default:
                    break;
            }
        }
    }

    private async updateDebuggerSourceMaps(): Promise<void> {
        // Make sure that we have an active debugging session at this point
        if (this.debugService.activeDebugSession) {
            const fileHashes = this.hashProvider.getHashes();

            this.pendingSourceMapResponseCount = fileHashes.length;

            fileHashes.forEach(async (fileHash) => {
                await this.debugService.activeDebugSession!.customRequest('setPydevdSourceMap', this.buildSourceMap(fileHash));
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
