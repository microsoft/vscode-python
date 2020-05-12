// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable, named } from 'inversify';

import { DebugAdapterTracker, Disposable, Event, EventEmitter } from 'vscode';
import { DebugProtocol } from 'vscode-debugprotocol';
import { IDebugService } from '../../common/application/types';
import { traceError } from '../../common/logger';
import { IConfigurationService, Resource } from '../../common/types';
import { DataFrameLoading, Identifiers } from '../constants';
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
export class DebuggerVariables implements IConditionalJupyterVariables, DebugAdapterTracker {
    private refreshEventEmitter = new EventEmitter<void>();
    private lastKnownVariables: IJupyterVariable[] = [];
    private topMostFrameId = 0;
    private importedIntoKernel = new Set<string>();
    private watchedNotebooks = new Map<string, Disposable[]>();
    private debuggingStarted = false;
    constructor(
        @inject(IJupyterDebugService) @named(Identifiers.MULTIPLEXING_DEBUGSERVICE) private debugService: IDebugService,
        @inject(IConfigurationService) private configService: IConfigurationService
    ) {}

    public get refreshRequired(): Event<void> {
        return this.refreshEventEmitter.event;
    }

    public get active(): boolean {
        return this.debugService.activeDebugSession !== undefined && this.debuggingStarted;
    }

    // IJupyterVariables implementation
    public async getVariables(
        notebook: INotebook,
        request: IJupyterVariablesRequest
    ): Promise<IJupyterVariablesResponse> {
        // Listen to notebook events if we haven't already
        this.watchNotebook(notebook);

        const result: IJupyterVariablesResponse = {
            executionCount: request.executionCount,
            pageStartIndex: 0,
            pageResponse: [],
            totalCount: 0
        };

        if (this.active) {
            const startPos = request.startIndex ? request.startIndex : 0;
            const chunkSize = request.pageSize ? request.pageSize : 100;
            result.pageStartIndex = startPos;

            // Do one at a time. All at once doesn't work as they all have to wait for each other anyway
            for (let i = startPos; i < startPos + chunkSize && i < this.lastKnownVariables.length; i += 1) {
                const fullVariable = !this.lastKnownVariables[i].truncated
                    ? this.lastKnownVariables[i]
                    : await this.getFullVariable(this.lastKnownVariables[i], notebook);
                this.lastKnownVariables[i] = fullVariable;
                result.pageResponse.push(fullVariable);
            }
            result.totalCount = this.lastKnownVariables.length;
        }

        return result;
    }

    public async getMatchingVariable(_notebook: INotebook, name: string): Promise<IJupyterVariable | undefined> {
        if (this.active) {
            // Note, full variable results isn't necessary for this call. It only really needs the variable value.
            return this.lastKnownVariables.find((v) => v.name === name);
        }
    }

    public async getDataFrameInfo(targetVariable: IJupyterVariable, notebook: INotebook): Promise<IJupyterVariable> {
        if (!this.active) {
            // No active server just return the unchanged target variable
            return targetVariable;
        }
        // Listen to notebook events if we haven't already
        this.watchNotebook(notebook);

        // See if we imported or not into the kernel our special function
        await this.importDataFrameScripts(notebook);

        // Then eval calling the main function with our target variable
        const results = await this.evaluate(
            `${DataFrameLoading.DataFrameInfoFunc}(${targetVariable.name})`,
            // tslint:disable-next-line: no-any
            (targetVariable as any).frameId
        );

        // Results should be the updated variable.
        return {
            ...targetVariable,
            ...JSON.parse(results.result.slice(1, -1))
        };
    }

    public async getDataFrameRows(
        targetVariable: IJupyterVariable,
        notebook: INotebook,
        start: number,
        end: number
    ): Promise<{}> {
        // Run the get dataframe rows script
        if (!this.debugService.activeDebugSession) {
            // No active server just return no rows
            return {};
        }
        // Listen to notebook events if we haven't already
        this.watchNotebook(notebook);

        // See if we imported or not into the kernel our special function
        await this.importDataFrameScripts(notebook);

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

    // tslint:disable-next-line: no-any
    public onDidSendMessage(message: any) {
        // When the initialize response comes back, indicate we have started.
        if (message.type === 'response' && message.command === 'initialize') {
            this.debuggingStarted = true;
        } else if (message.type === 'response' && message.command === 'variables') {
            // If using the interactive debugger, update our variables.
            // tslint:disable-next-line: no-suspicious-comment
            // TODO: Figure out what resource to use
            this.updateVariables(undefined, message as DebugProtocol.VariablesResponse);
        } else if (message.type === 'response' && message.command === 'stackTrace') {
            // This should be the top frame. We need to use this to compute the value of a variable
            this.updateStackFrame(message as DebugProtocol.StackTraceResponse);
        } else if (message.type === 'event' && message.event === 'terminated') {
            // When the debugger exits, make sure the variables are cleared
            this.lastKnownVariables = [];
            this.topMostFrameId = 0;
            this.debuggingStarted = false;
            this.refreshEventEmitter.fire();
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

    private async importDataFrameScripts(notebook: INotebook): Promise<void> {
        try {
            const key = notebook.identity.toString();
            if (!this.importedIntoKernel.has(key)) {
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

    private updateStackFrame(stackResponse: DebugProtocol.StackTraceResponse) {
        if (stackResponse.body.stackFrames[0]) {
            this.topMostFrameId = stackResponse.body.stackFrames[0].id;
        }
    }

    private async getFullVariable(variable: IJupyterVariable, notebook: INotebook): Promise<IJupyterVariable> {
        // See if we imported or not into the kernel our special function
        await this.importDataFrameScripts(notebook);

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

        const allowedVariables = variablesResponse.body.variables.filter((v) => {
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
        });

        this.lastKnownVariables = allowedVariables.map((v) => {
            return {
                name: v.name,
                type: v.type!,
                count: 0,
                shape: '',
                size: 0,
                supportsDataExplorer: DataViewableTypes.has(v.type || ''),
                value: v.value,
                truncated: true,
                frameId: v.variablesReference
            };
        });

        this.refreshEventEmitter.fire();
    }
}
