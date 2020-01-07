// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { traceVerbose } from '../../../common/logger';
import { IFileSystem } from '../../../common/platform/types';
import { IPersistentStateFactory, Resource } from '../../../common/types';
import { CURRENT_PATH_SERVICE, IInterpreterHelper, IInterpreterLocatorService } from '../../contracts';
import { AutoSelectionRule, IInterpreterAutoSelectionService } from '../types';
import { BaseRuleService, NextAction } from './baseRule';

@injectable()
export class CurrentPathInterpretersAutoSelectionRule extends BaseRuleService {
    constructor(
        @inject(IFileSystem) fs: IFileSystem,
        @inject(IInterpreterHelper) private readonly helper: IInterpreterHelper,
        @inject(IPersistentStateFactory) stateFactory: IPersistentStateFactory,
        @inject(IInterpreterLocatorService) @named(CURRENT_PATH_SERVICE) private readonly currentPathInterpreterLocator: IInterpreterLocatorService
    ) {
        super(AutoSelectionRule.currentPath, fs, stateFactory);
    }
    protected async onAutoSelectInterpreter(resource: Resource, manager?: IInterpreterAutoSelectionService): Promise<NextAction> {
        const interpreters = await this.currentPathInterpreterLocator.getInterpreters(resource);
        const bestInterpreter = this.helper.getBestInterpreter(interpreters);
        traceVerbose(`Selected Interpreter from ${this.ruleName}, ${bestInterpreter ? JSON.stringify(bestInterpreter) : 'Nothing Selected'}`);
        return (await this.setGlobalInterpreter(bestInterpreter, manager)) ? NextAction.exit : NextAction.runNextRule;
    }
}
