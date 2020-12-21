// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { traceVerbose } from '../../../common/logger';
import { IFileSystem } from '../../../common/platform/types';
import { IPersistentStateFactory, Resource } from '../../../common/types';
import { IInterpreterHelper } from '../../contracts';
import { AutoSelectionRule, IInterpreterAutoSelectionRule, IInterpreterAutoSelectionService } from '../types';
import { BaseRuleService, NextAction } from './baseRule';

@injectable()
export class CachedInterpretersAutoSelectionRule extends BaseRuleService {
    protected readonly rules: IInterpreterAutoSelectionRule[];
    constructor(
        @inject(IFileSystem) fs: IFileSystem,
        @inject(IInterpreterHelper) private readonly helper: IInterpreterHelper,
        @inject(IPersistentStateFactory) stateFactory: IPersistentStateFactory,
        @inject(IInterpreterAutoSelectionRule)
        @named(AutoSelectionRule.systemWide)
        systemInterpreter: IInterpreterAutoSelectionRule,
        @inject(IInterpreterAutoSelectionRule)
        @named(AutoSelectionRule.currentPath)
        currentPathInterpreter: IInterpreterAutoSelectionRule,
        @inject(IInterpreterAutoSelectionRule)
        @named(AutoSelectionRule.windowsRegistry)
        winRegInterpreter: IInterpreterAutoSelectionRule,
    ) {
        super(AutoSelectionRule.cachedInterpreters, fs, stateFactory);
        this.rules = [systemInterpreter, currentPathInterpreter, winRegInterpreter];
    }
    protected async onAutoSelectInterpreter(
        resource: Resource,
        manager?: IInterpreterAutoSelectionService,
    ): Promise<NextAction> {
        const cachedInterpreters = this.rules
            .map((item) => item.getPreviouslyAutoSelectedInterpreter(resource))
            .filter((item) => !!item)
            .map((item) => item!);
        const bestInterpreter = this.helper.getBestInterpreter(cachedInterpreters);
        traceVerbose(
            `Selected Interpreter from ${this.ruleName}, ${
                bestInterpreter ? JSON.stringify(bestInterpreter) : 'Nothing Selected'
            }`,
        );
        return (await this.setGlobalInterpreter(bestInterpreter, manager)) ? NextAction.exit : NextAction.runNextRule;
    }
}
