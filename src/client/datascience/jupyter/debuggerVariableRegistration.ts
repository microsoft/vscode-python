// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable, named } from 'inversify';
import { DebugAdapterTracker, DebugAdapterTrackerFactory, DebugSession, ProviderResult } from 'vscode';
import { IExtensionSingleActivationService } from '../../activation/types';
import { IDebugService } from '../../common/application/types';
import { PYTHON_LANGUAGE } from '../../common/constants';
import { IDisposableRegistry } from '../../common/types';
import { Identifiers } from '../constants';
import { IJupyterDebugService, IJupyterVariables } from '../types';

@injectable()
export class DebuggerVariableRegistration implements IExtensionSingleActivationService, DebugAdapterTrackerFactory {
    constructor(
        @inject(IJupyterDebugService) @named(Identifiers.MULTIPLEXING_DEBUGSERVICE) private debugService: IDebugService,
        @inject(IDisposableRegistry) private disposables: IDisposableRegistry,
        @inject(IJupyterVariables) @named(Identifiers.DEBUGGER_VARIABLES) private debugVariables: DebugAdapterTracker
    ) {}
    public activate(): Promise<void> {
        this.disposables.push(this.debugService.registerDebugAdapterTrackerFactory(PYTHON_LANGUAGE, this));
        return Promise.resolve();
    }

    public createDebugAdapterTracker(_session: DebugSession): ProviderResult<DebugAdapterTracker> {
        return this.debugVariables;
    }
}
