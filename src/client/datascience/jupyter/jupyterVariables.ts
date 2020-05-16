// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import type { JSONObject } from '@phosphor/coreutils';
import { inject, injectable, named } from 'inversify';

import { Event, EventEmitter } from 'vscode';
import { RunByLine } from '../../common/experimentGroups';
import { IDisposableRegistry, IExperimentsManager } from '../../common/types';
import { captureTelemetry } from '../../telemetry';
import { Identifiers, Telemetry } from '../constants';
import {
    IConditionalJupyterVariables,
    IJupyterVariable,
    IJupyterVariables,
    IJupyterVariablesRequest,
    IJupyterVariablesResponse,
    INotebook
} from '../types';

/**
 * This class provides variable data for showing in the interactive window or a notebook.
 * It multiplexes to either one that will use the jupyter kernel or one that uses the debugger.
 */
@injectable()
export class JupyterVariables implements IJupyterVariables {
    private refreshEventEmitter = new EventEmitter<void>();

    constructor(
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry,
        @inject(IExperimentsManager) private experimentsManager: IExperimentsManager,
        @inject(IJupyterVariables) @named(Identifiers.OLD_VARIABLES) private oldVariables: IJupyterVariables,
        @inject(IJupyterVariables) @named(Identifiers.KERNEL_VARIABLES) private kernelVariables: IJupyterVariables,
        @inject(IJupyterVariables)
        @named(Identifiers.DEBUGGER_VARIABLES)
        private debuggerVariables: IConditionalJupyterVariables
    ) {
        disposableRegistry.push(debuggerVariables.refreshRequired(this.fireRefresh.bind(this)));
        disposableRegistry.push(kernelVariables.refreshRequired(this.fireRefresh.bind(this)));
        disposableRegistry.push(oldVariables.refreshRequired(this.fireRefresh.bind(this)));
    }

    public get refreshRequired(): Event<void> {
        return this.refreshEventEmitter.event;
    }

    // IJupyterVariables implementation
    @captureTelemetry(Telemetry.VariableExplorerFetchTime, undefined, true)
    public async getVariables(
        notebook: INotebook,
        request: IJupyterVariablesRequest
    ): Promise<IJupyterVariablesResponse> {
        return this.realVariables.getVariables(notebook, request);
    }

    public getMatchingVariable(notebook: INotebook, name: string): Promise<IJupyterVariable | undefined> {
        return this.realVariables.getMatchingVariable(notebook, name);
    }

    public async getDataFrameInfo(targetVariable: IJupyterVariable, notebook: INotebook): Promise<IJupyterVariable> {
        return this.realVariables.getDataFrameInfo(targetVariable, notebook);
    }

    public async getDataFrameRows(
        targetVariable: IJupyterVariable,
        notebook: INotebook,
        start: number,
        end: number
    ): Promise<JSONObject> {
        return this.realVariables.getDataFrameRows(targetVariable, notebook, start, end);
    }

    private get realVariables(): IJupyterVariables {
        if (!this.experimentsManager.inExperiment(RunByLine.experiment)) {
            return this.oldVariables;
        }
        if (this.debuggerVariables.active) {
            return this.debuggerVariables;
        }

        return this.kernelVariables;
    }

    private fireRefresh() {
        this.refreshEventEmitter.fire();
    }
}
