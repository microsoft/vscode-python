// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { traceVerbose } from '../../../common/logger';
import { IFileSystem } from '../../../common/platform/types';
import { IPersistentStateFactory, Resource } from '../../../common/types';
import { IInterpreterHelper, IInterpreterService, InterpreterType } from '../../contracts';
import { AutoSelectionRule, IInterpreterAutoSelectionService } from '../types';
import { BaseRuleService, NextAction } from './baseRule';

@injectable()
export class SystemWideInterpretersAutoSelectionRule extends BaseRuleService {
    constructor(
        @inject(IFileSystem) fs: IFileSystem,
        @inject(IInterpreterHelper) private readonly helper: IInterpreterHelper,
        @inject(IPersistentStateFactory) stateFactory: IPersistentStateFactory,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService
    ) {
        super(AutoSelectionRule.systemWide, fs, stateFactory);
    }
    protected async onAutoSelectInterpreter(
        resource: Resource,
        manager?: IInterpreterAutoSelectionService
    ): Promise<NextAction> {
        const interpreters = await this.interpreterService.getInterpreters(resource);
        // Exclude non-local interpreters.
        const filteredInterpreters = interpreters.filter(
            int =>
                int.type !== InterpreterType.VirtualEnv &&
                int.type !== InterpreterType.Venv &&
                int.type !== InterpreterType.Pipenv
        );
        const bestInterpreter = this.helper.getBestInterpreter(filteredInterpreters);
        traceVerbose(
            `Selected Interpreter from ${this.ruleName}, ${
                bestInterpreter ? JSON.stringify(bestInterpreter) : 'Nothing Selected'
            }`
        );
        return (await this.setGlobalInterpreter(bestInterpreter, manager)) ? NextAction.exit : NextAction.runNextRule;
    }
}
