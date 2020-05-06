// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';

import { DebugAdapterTracker, Event, EventEmitter } from 'vscode';
import { DebugProtocol } from 'vscode-debugprotocol';
import { IDebugService } from '../../common/application/types';
import { traceError } from '../../common/logger';
import { IConfigurationService, Resource } from '../../common/types';
import { DataFrameLoading } from '../constants';
import {
    IJupyterVariable,
    IJupyterVariables,
    IJupyterVariablesRequest,
    IJupyterVariablesResponse,
    INotebook
} from '../types';

const DataViewableTypes: Set<string> = new Set<string>(['DataFrame', 'list', 'dict', 'ndarray', 'Series']);
const KnownExcludedVariables = new Set<string>(['In', 'Out', 'exit', 'quit']);

@injectable()
export class DebuggerVariables implements IJupyterVariables, DebugAdapterTracker {
    private imported = false;
    private refreshEventEmitter = new EventEmitter<void>();
    private lastKnownVariables: IJupyterVariable[] = [];
    private topMostFrameId = 0;
    constructor(
        @inject(IDebugService) private debugService: IDebugService,
        @inject(IConfigurationService) private configService: IConfigurationService
    ) {}

    public get refreshRequired(): Event<void> {
        return this.refreshEventEmitter.event;
    }

    // IJupyterVariables implementation
    public async getVariables(
        _notebook: INotebook,
        request: IJupyterVariablesRequest
    ): Promise<IJupyterVariablesResponse> {
        const result: IJupyterVariablesResponse = {
            executionCount: request.executionCount,
            pageStartIndex: 0,
            pageResponse: [],
            totalCount: 0
        };

        if (this.debugService.activeDebugSession) {
            result.pageResponse = this.lastKnownVariables;
            result.totalCount = this.lastKnownVariables.length;
        }

        return result;
    }

    public async getDataFrameInfo(targetVariable: IJupyterVariable, _notebook: INotebook): Promise<IJupyterVariable> {
        if (!this.debugService.activeDebugSession) {
            // No active server just return the unchanged target variable
            return targetVariable;
        }

        // See if we imported or not into the kernel our special function
        if (!this.imported) {
            this.imported = await this.importDataFrameScripts();
        }

        // Then eval calling the main function with our target variable
        const results = await this.debugService.activeDebugSession.customRequest('evaluate', {
            expression: `${DataFrameLoading.DataFrameInfoFunc}(${targetVariable.name})`,
            frameId: this.topMostFrameId,
            context: 'repl'
        });

        // Results should be the updated variable.
        return {
            ...targetVariable,
            ...JSON.parse(results.result.slice(1, -1))
        };
    }

    public async getDataFrameRows(
        targetVariable: IJupyterVariable,
        _notebook: INotebook,
        start: number,
        end: number
    ): Promise<{}> {
        // Run the get dataframe rows script
        if (!this.debugService.activeDebugSession) {
            // No active server just return no rows
            return {};
        }

        // See if we imported or not into the kernel our special function
        if (!this.imported) {
            this.imported = await this.importDataFrameScripts();
        }

        // Then eval calling the main function with our target variable
        const minnedEnd = Math.min(end, targetVariable.rowCount || 0);
        const results = await this.debugService.activeDebugSession.customRequest('evaluate', {
            expression: `${DataFrameLoading.DataFrameRowFunc}(${targetVariable.name}, ${start}, ${minnedEnd})`,
            frameId: this.topMostFrameId,
            context: 'repl'
        });

        // Results should be the row.
        return JSON.parse(results.result.slice(1, -1));
    }

    public onDidSendMessage(message: DebugProtocol.Response) {
        // If using the interactive debugger, update our variables.
        if (message.type === 'response' && message.command === 'variables') {
            // tslint:disable-next-line: no-suspicious-comment
            // TODO: Figure out what resource to use
            this.updateVariables(undefined, message as DebugProtocol.VariablesResponse);
        } else if (message.type === 'response' && message.command === 'stackTrace') {
            // This should be the top frame. We need to use this to compute the value of a variable
            this.updateStackFrame(message as DebugProtocol.StackTraceResponse);
        }
    }

    // tslint:disable-next-line: no-any
    private async evalute(code: string): Promise<any> {
        if (this.debugService.activeDebugSession) {
            return this.debugService.activeDebugSession.customRequest('evaluate', {
                expression: code,
                frameId: this.topMostFrameId,
                context: 'repl'
            });
        }
        throw Error('Debugger is not active, cannot evaluate.');
    }

    private async importDataFrameScripts(): Promise<boolean> {
        try {
            await this.evalute(DataFrameLoading.DataFrameSysImport);
            await this.evalute(DataFrameLoading.DataFrameInfoImport);
            await this.evalute(DataFrameLoading.DataFrameRowImport);
            return true;
        } catch (exc) {
            traceError('Error attempting to import in debugger', exc);
            return false;
        }
    }

    private updateStackFrame(stackResponse: DebugProtocol.StackTraceResponse) {
        if (stackResponse.body.stackFrames[0]) {
            this.topMostFrameId = stackResponse.body.stackFrames[0].id;
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
                truncated: false,
                frameId: v.variablesReference
            };
        });

        this.refreshEventEmitter.fire();
    }
}
