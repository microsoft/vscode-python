// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import type { JSONObject } from '@phosphor/coreutils';
import { inject, injectable, named } from 'inversify';

import { IDebugService } from '../../common/application/types';
import { captureTelemetry } from '../../telemetry';
import { Identifiers, Telemetry } from '../constants';
import {
    IJupyterVariable,
    IJupyterVariables,
    IJupyterVariablesRequest,
    IJupyterVariablesResponse,
    INotebook
} from '../types';

// Regexes for parsing data from Python kernel. Not sure yet if other
// kernels will add the ansi encoding.

@injectable()
export class JupyterVariables implements IJupyterVariables {
    constructor(
        @inject(IDebugService) private debugService: IDebugService,
        @inject(IJupyterVariables) @named(Identifiers.KERNEL_VARIABLES) private kernelVariables: IJupyterVariables,
        @inject(IJupyterVariables) @named(Identifiers.DEBUGGER_VARIABLES) private debuggerVariables: IJupyterVariables
    ) {}

    // IJupyterVariables implementation
    @captureTelemetry(Telemetry.VariableExplorerFetchTime, undefined, true)
    public async getVariables(
        notebook: INotebook,
        request: IJupyterVariablesRequest
    ): Promise<IJupyterVariablesResponse> {
        return this.realVariables.getVariables(notebook, request);
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
        if (this.debugService.activeDebugSession) {
            return this.debuggerVariables;
        }

        return this.kernelVariables;
    }
}
