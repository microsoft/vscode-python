// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import type { JSONObject } from '@phosphor/coreutils';
import { inject, injectable } from 'inversify';

import { DebugAdapterTracker, Event, EventEmitter } from 'vscode';
import { DebugProtocol } from 'vscode-debugprotocol';
import { IDebugService } from '../../common/application/types';
import { IFileSystem } from '../../common/platform/types';
import { IConfigurationService, Resource } from '../../common/types';
import {
    IJupyterVariable,
    IJupyterVariables,
    IJupyterVariablesRequest,
    IJupyterVariablesResponse,
    INotebook
} from '../types';
//import { VariableScriptLoader } from './variableScriptLoader';

const DataViewableTypes: Set<string> = new Set<string>(['DataFrame', 'list', 'dict', 'ndarray', 'Series']);
const KnownExcludedVariables = new Set<string>(['In', 'Out', 'exit', 'quit']);

@injectable()
export class DebuggerVariables implements IJupyterVariables, DebugAdapterTracker {
    //private scriptLoader: VariableScriptLoader;
    private refreshEventEmitter = new EventEmitter<void>();
    private lastKnownVariables: IJupyterVariable[] = [];
    constructor(
        @inject(IFileSystem) _fileSystem: IFileSystem,
        @inject(IDebugService) private debugService: IDebugService,
        @inject(IConfigurationService) private configService: IConfigurationService
    ) {
        //this.scriptLoader = new VariableScriptLoader(fileSystem);
    }

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
        return targetVariable;
    }

    public async getDataFrameRows(
        targetVariable: IJupyterVariable,
        _notebook: INotebook,
        _start: number,
        _end: number
    ): Promise<JSONObject> {
        return JSON.parse(targetVariable.toString());
    }

    public onDidSendMessage(message: DebugProtocol.Response) {
        if (message.type === 'response' && message.command === 'variables') {
            // tslint:disable-next-line: no-suspicious-comment
            // TODO: Figure out what resource to use
            this.updateVariables(undefined, message as DebugProtocol.VariablesResponse);
        }
    }

    public updateVariables(resource: Resource, variablesResponse: DebugProtocol.VariablesResponse) {
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
                truncated: false
            };
        });

        this.refreshEventEmitter.fire();
    }
}
