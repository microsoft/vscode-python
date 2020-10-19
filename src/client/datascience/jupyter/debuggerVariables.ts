// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable, named } from 'inversify';

import { DebugAdapterTracker, Disposable, Event, EventEmitter } from 'vscode';
import { DebugProtocol } from 'vscode-debugprotocol';
import { IDebugService } from '../../common/application/types';
import { traceError } from '../../common/logger';
import { IConfigurationService, Resource } from '../../common/types';
import { sendTelemetryEvent } from '../../telemetry';
import { DataFrameLoading, Identifiers, Telemetry } from '../constants';
import { DebugLocationTracker } from '../debugLocationTracker';
import {
    IConditionalJupyterVariables,
    IJupyterDebugService,
    IJupyterVariable,
    IJupyterVariablesRequest,
    IJupyterVariablesResponse,
    INotebook
} from '../types';

const DataViewableTypes: Set<string> = new Set<string>(['DataFrame', 'list', 'dict', 'ndarray', 'Series']);
const KnownExcludedVariables = new Set<string>(['In', 'Out', 'exit', 'quit']);

@injectable()
export class DebuggerVariables extends DebugLocationTracker
    implements IConditionalJupyterVariables, DebugAdapterTracker {
    private refreshEventEmitter = new EventEmitter<void>();
    private lastKnownVariables: IJupyterVariable[] = [];
    private importedIntoKernel = new Set<string>();
    private watchedNotebooks = new Map<string, Disposable[]>();
    private debuggingStarted = false;
    constructor(
        @inject(IJupyterDebugService) @named(Identifiers.MULTIPLEXING_DEBUGSERVICE) private debugService: IDebugService,
        @inject(IConfigurationService) private configService: IConfigurationService
    ) {
        super(undefined);
    }

    public get refreshRequired(): Event<void> {
        return this.refreshEventEmitter.event;
    }

    public get active(): boolean {
        return this.debugService.activeDebugSession !== undefined && this.debuggingStarted;
    }

    // IJupyterVariables implementation
    public async getVariables(
        request: IJupyterVariablesRequest,
        notebook?: INotebook
    ): Promise<IJupyterVariablesResponse> {
        // Listen to notebook events if we haven't already
        if (notebook) {
            this.watchNotebook(notebook);
        }

        const result: IJupyterVariablesResponse = {
            executionCount: request.executionCount,
            pageStartIndex: 0,
            pageResponse: [],
            totalCount: 0,
            refreshCount: request.refreshCount
        };

        if (this.active) {
            const startPos = request.startIndex ? request.startIndex : 0;
            const chunkSize = request.pageSize ? request.pageSize : 100;
            result.pageStartIndex = startPos;

            // Do one at a time. All at once doesn't work as they all have to wait for each other anyway
            for (let i = startPos; i < startPos + chunkSize && i < this.lastKnownVariables.length; i += 1) {
                const fullVariable = !this.lastKnownVariables[i].truncated
                    ? this.lastKnownVariables[i]
                    : await this.getFullVariable(this.lastKnownVariables[i]);
                this.lastKnownVariables[i] = fullVariable;
                result.pageResponse.push(fullVariable);
            }
            result.totalCount = this.lastKnownVariables.length;
        }

        return result;
    }

    public async getMatchingVariable(name: string, notebook?: INotebook): Promise<IJupyterVariable | undefined> {
        if (this.active) {
            // Note, full variable results isn't necessary for this call. It only really needs the variable value.
            const result = this.lastKnownVariables.find((v) => v.name === name);
            if (result && notebook && notebook.identity.fsPath.endsWith('.ipynb')) {
                sendTelemetryEvent(Telemetry.RunByLineVariableHover);
            }
            return result;
        }
    }

    public async getDataFrameInfo(targetVariable: IJupyterVariable, notebook?: INotebook): Promise<IJupyterVariable> {
        if (!this.active) {
            // No active server just return the unchanged target variable
            return targetVariable;
        }
        // Listen to notebook events if we haven't already
        if (notebook) {
            this.watchNotebook(notebook);
        }

        // See if we imported or not into the kernel our special function
        await this.importDataFrameScripts();

        // Then eval calling the main function with our target variable
        const results = await this.evaluate(
            `${DataFrameLoading.DataFrameInfoFunc}(${targetVariable.name})`,
            // tslint:disable-next-line: no-any
            (targetVariable as any).frameId
        );

        // Results should be the updated variable.
        return results
            ? {
                  ...targetVariable,
                  ...JSON.parse(results.result.slice(1, -1))
              }
            : targetVariable;
    }

    public async getDataFrameRows(
        targetVariable: IJupyterVariable,
        start: number,
        end: number,
        notebook?: INotebook
    ): Promise<{}> {
        // Run the get dataframe rows script
        if (!this.debugService.activeDebugSession || targetVariable.columns === undefined) {
            // No active server just return no rows
            return {};
        }
        // Listen to notebook events if we haven't already
        if (notebook) {
            this.watchNotebook(notebook);
        }

        // See if we imported or not into the kernel our special function
        await this.importDataFrameScripts();

        // Since the debugger splits up long requests, split this based on the number of items.

        // Maximum 100 cells at a time or one row
        // tslint:disable-next-line: no-any
        let output: any;
        const minnedEnd = Math.min(targetVariable.rowCount || 0, end);
        const totalRowCount = end - start;
        const cellsPerRow = targetVariable.columns!.length;
        const chunkSize = Math.floor(Math.max(1, Math.min(100 / cellsPerRow, totalRowCount / cellsPerRow)));
        for (let pos = start; pos < end; pos += chunkSize) {
            const chunkEnd = Math.min(pos + chunkSize, minnedEnd);
            const results = await this.evaluate(
                `${DataFrameLoading.DataFrameRowFunc}(${targetVariable.name}, ${pos}, ${chunkEnd})`,
                // tslint:disable-next-line: no-any
                (targetVariable as any).frameId
            );
            const chunkResults = JSON.parse(results.result.slice(1, -1));
            if (output && output.data) {
                output = {
                    ...output,
                    data: output.data.concat(chunkResults.data)
                };
            } else {
                output = chunkResults;
            }
        }

        // Results should be the rows.
        return output;
    }

    // This special DebugAdapterTracker function listens to messages sent from the debug adapter to VS Code
    // tslint:disable-next-line: no-any
    public onDidSendMessage(message: any) {
        super.onDidSendMessage(message);
        // When the initialize response comes back, indicate we have started.
        if (message.type === 'response' && message.command === 'initialize') {
            this.debuggingStarted = true;
        } else if (message.type === 'response' && message.command === 'variables' && message.body) {
            // If using the interactive debugger, update our variables.
            // tslint:disable-next-line: no-suspicious-comment
            // TODO: Figure out what resource to use
            this.updateVariables(undefined, message as DebugProtocol.VariablesResponse);
        } else if (message.type === 'event' && message.event === 'terminated') {
            // When the debugger exits, make sure the variables are cleared
            this.lastKnownVariables = [];
            this.topMostFrameId = 0;
            this.debuggingStarted = false;
            this.refreshEventEmitter.fire();
            const key = this.debugService.activeDebugSession?.id;
            if (key) {
                this.importedIntoKernel.delete(key);
            }
        }
    }

    private watchNotebook(notebook: INotebook) {
        const key = notebook.identity.toString();
        if (!this.watchedNotebooks.has(key)) {
            const disposables: Disposable[] = [];
            disposables.push(notebook.onKernelChanged(this.resetImport.bind(this, key)));
            disposables.push(notebook.onKernelRestarted(this.resetImport.bind(this, key)));
            disposables.push(
                notebook.onDisposed(() => {
                    this.resetImport(key);
                    disposables.forEach((d) => d.dispose());
                    this.watchedNotebooks.delete(key);
                })
            );
            this.watchedNotebooks.set(key, disposables);
        }
    }

    private resetImport(key: string) {
        this.importedIntoKernel.delete(key);
    }

    // tslint:disable-next-line: no-any
    private async evaluate(code: string, frameId?: number): Promise<any> {
        if (this.debugService.activeDebugSession) {
            const results = await this.debugService.activeDebugSession.customRequest('evaluate', {
                expression: code,
                frameId: this.topMostFrameId || frameId,
                context: 'repl'
            });
            if (results && results.result !== 'None') {
                return results;
            } else {
                traceError(`Cannot evaluate ${code}`);
                return undefined;
            }
        }
        throw Error('Debugger is not active, cannot evaluate.');
    }

    private async importDataFrameScripts(): Promise<void> {
        try {
            // Run our dataframe scripts only once per session because they're slow
            const key = this.debugService.activeDebugSession?.id;
            if (key && !this.importedIntoKernel.has(key)) {
                await this.evaluate(DataFrameLoading.DataFrameSysImport);
                await this.evaluate(DataFrameLoading.DataFrameInfoImport);
                await this.evaluate(DataFrameLoading.DataFrameRowImport);
                await this.evaluate(DataFrameLoading.VariableInfoImport);
                this.importedIntoKernel.add(key);
            }
        } catch (exc) {
            traceError('Error attempting to import in debugger', exc);
        }
    }

    private async getFullVariable(variable: IJupyterVariable): Promise<IJupyterVariable> {
        // See if we imported or not into the kernel our special function
        await this.importDataFrameScripts();

        // Then eval calling the variable info function with our target variable
        const results = await this.evaluate(
            `${DataFrameLoading.VariableInfoFunc}(${variable.name})`,
            // tslint:disable-next-line: no-any
            (variable as any).frameId
        );
        if (results && results.result) {
            // Results should be the updated variable.
            return {
                ...variable,
                truncated: false,
                ...JSON.parse(results.result.slice(1, -1))
            };
        } else {
            // If no results, just return current value. Better than nothing.
            return variable;
        }
    }

    private updateVariables(resource: Resource, variablesResponse: DebugProtocol.VariablesResponse) {
        const exclusionList = this.configService.getSettings(resource).datascience.variableExplorerExclude
            ? this.configService.getSettings().datascience.variableExplorerExclude?.split(';')
            : [];

        const allowedVariables = variablesResponse.body.variables
            .filter((v) => {
                if (!v.name || !v.type || !v.value) {
                    return false;
                }
                if (exclusionList && exclusionList.includes(v.type)) {
                    return false;
                }
                if (v.name.startsWith('_')) {
                    return false;
                }
                if (KnownExcludedVariables.has(v.name)) {
                    return false;
                }
                if (v.type === 'NoneType') {
                    return false;
                }
                return true;
            })
            .map((v) => {
                if (v.type && DataViewableTypes.has(v.type)) {
                    // tslint:disable-next-line: no-any
                    (v as any).__vscodeVariableMenuContext = 'viewableInDataViewer';
                }
                return v;
            });

        this.lastKnownVariables = allowedVariables.map((v) => {
            return convertDebugProtocolVariableToIJupyterVariable(v);
        });

        this.refreshEventEmitter.fire();
    }
}

export function convertDebugProtocolVariableToIJupyterVariable(variable: DebugProtocol.Variable) {
    return {
        name: variable.name,
        type: variable.type!,
        count: 0,
        shape: '',
        size: 0,
        supportsDataExplorer: DataViewableTypes.has(variable.type || ''),
        value: variable.value,
        truncated: true,
        frameId: variable.variablesReference
    };
}
