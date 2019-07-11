// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { nbformat } from '@jupyterlab/coreutils';
import { inject, injectable } from 'inversify';
import * as uuid from 'uuid/v4';
import { DebugConfiguration } from 'vscode';

import { IApplicationShell, ICommandManager, IDebugService } from '../../common/application/types';
import { traceInfo, traceWarning } from '../../common/logger';
import { IPlatformService } from '../../common/platform/types';
import { IConfigurationService } from '../../common/types';
import { Identifiers } from '../constants';
import {
    CellState,
    ICell,
    ICellHashListener,
    IDebuggerConnectInfo,
    IFileHashes,
    IJupyterDebugger,
    INotebookServer,
    ISourceMapRequest
} from '../types';

interface IPtvsdVersion {
    major: number;
    minor: number;
    revision: string;
}

@injectable()
export class JupyterDebugger implements IJupyterDebugger, ICellHashListener {
    private connectInfo: IDebuggerConnectInfo | undefined;
    private requiredPtvsdVersion: IPtvsdVersion = { major: 4, minor: 3, revision: '' };
    constructor(
        @inject(IApplicationShell) private appShell: IApplicationShell,
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(ICommandManager) private commandManager: ICommandManager,
        @inject(IDebugService) private debugService: IDebugService,
        @inject(IPlatformService) private platform: IPlatformService
    ) {
    }

    public async enableAttach(server: INotebookServer): Promise<void> {
        traceInfo('enable debugger attach');

        // Current version of ptvsd doesn't support the source map entries, so we need to have a custom copy
        // on disk somewhere. Append this location to our sys path.
        // tslint:disable-next-line:no-multiline-string
        let extraPath = this.configService.getSettings().datascience.ptvsdDistPath;
        // Escape windows path chars so they end up in the source escaped
        if (this.platform.isWindows && extraPath) {
            extraPath = extraPath.replace('\\', '\\\\');
        }
        await this.executeSilently(server, `import sys\r\nsys.path.append('${extraPath}')\r\nsys.path`);

        // tslint:disable-next-line:no-multiline-string
        const enableDebuggerResults = await this.executeSilently(server, `import ptvsd\r\nptvsd.enable_attach(('localhost', 0))`);

        // Save our connection info to this server
        this.connectInfo = this.parseConnectInfo(enableDebuggerResults);

        // Force the debugger to update its list of breakpoints
        this.debugService.removeBreakpoints([]);
    }

    public async startDebugging(server: INotebookServer): Promise<void> {
        traceInfo('start debugging');

        const ptvsdVersion = await this.ptvsdCheck(server);

        if (!ptvsdVersion || !this.ptvsdMeetsRequirement(ptvsdVersion)) {
            await this.promptToInstallPtvsd(server, ptvsdVersion);
        }

        if (this.connectInfo) {
            // First connect the VSCode UI
            const config: DebugConfiguration = {
                name: 'IPython',
                request: 'attach',
                type: 'python',
                port: this.connectInfo.port,
                host: this.connectInfo.hostName,
                justMyCode: true
                // logToFile: true <-- This will log a debug log file to the extension root folder.
            };

            await this.debugService.startDebugging(undefined, config);

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
        traceInfo('stop debugging');

        // Stop our debugging UI session, no await as we just want it stopped
        this.commandManager.executeCommand('workbench.action.debug.stop');

        // Disable tracing after we disconnect because we don't want to step through this
        // code if the user was in step mode.
        // tslint:disable-next-line:no-multiline-string
        await this.executeSilently(server, `from ptvsd import tracing\ntracing(False)`);
    }

    public async hashesUpdated(hashes: IFileHashes[]): Promise<void> {
        // Make sure that we have an active debugging session at this point
        if (this.debugService.activeDebugSession) {
            await Promise.all(hashes.map((fileHash) => {
                return this.debugService.activeDebugSession!.customRequest('setPydevdSourceMap', this.buildSourceMap(fileHash));
            }));
        }
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

    // Returns either the version of ptvsd installed or undefined if not installed
    private async ptvsdCheck(server: INotebookServer): Promise<IPtvsdVersion | undefined> {
        // tslint:disable-next-line:no-multiline-string
        const ptvsdVersionResults = await this.executeSilently(server, `import ptvsd\r\nptvsd.__version__`);
        return this.parsePtvsdVersionInfo(ptvsdVersionResults);
    }

    private parsePtvsdVersionInfo(cells: ICell[]): IPtvsdVersion | undefined {
        if (cells.length < 1 || cells[0].state !== CellState.finished) {
            return undefined;
        }

        const targetCell = cells[0];

        const outputString = this.extractOutput(targetCell);

        if (outputString) {
            const packageVersionRegex = /'([0-9]+).([0-9]+).([0-9a-zA-Z]+)/;
            const packageVersionMatch = packageVersionRegex.exec(outputString);

            if (packageVersionMatch) {
                return {
                    major: parseInt(packageVersionMatch[1], 10), minor: parseInt(packageVersionMatch[2], 10), revision: packageVersionMatch[3]
                };
            }
        }

        return undefined;
    }

    private ptvsdMeetsRequirement(version: IPtvsdVersion): boolean {
        if (version.major > this.requiredPtvsdVersion.major) {
            return true;
        } else if (version.major === this.requiredPtvsdVersion.major && version.minor >= this.requiredPtvsdVersion.minor) {
            return true;
        }

        return false;
    }

    private async promptToInstallPtvsd(server: INotebookServer, oldVersion: IPtvsdVersion | undefined): Promise<void> {
        // tslint:disable-next-line:messages-must-be-localized
        const result = await this.appShell.showInformationMessage('Install Ptvsd?', 'Yes', 'No');

        if (result === 'Yes') {
            await this.installPtvsd(server);
        }
    }

    private async installPtvsd(server: INotebookServer): Promise<void> {
        // tslint:disable-next-line:no-multiline-string
        const ptvsdInstallResults = await this.executeSilently(server, `!pip install --pre ptvsd`);
        // IANHU: Need a default timeout here? How long will pip try for?

        if (ptvsdInstallResults.length > 0) {
            const installResultsString = this.extractOutput(ptvsdInstallResults[0]);

            if (installResultsString && installResultsString.includes('Successfully installed')) {
                return;
            }
        }

        // Any failures and we need to warn that we failed to install
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
