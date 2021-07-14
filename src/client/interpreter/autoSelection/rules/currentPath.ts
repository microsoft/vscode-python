// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { inDiscoveryExperiment } from '../../../common/experiments/helpers';
import { traceVerbose } from '../../../common/logger';
import { IFileSystem } from '../../../common/platform/types';
import { IExperimentService, IPersistentStateFactory, Resource } from '../../../common/types';
import { IServiceContainer } from '../../../ioc/types';
import { PythonEnvSource } from '../../../pythonEnvironments/base/info';
import {
    CURRENT_PATH_SERVICE,
    IComponentAdapter,
    IInterpreterHelper,
    IInterpreterLocatorService,
} from '../../contracts';
import { AutoSelectionRule, IInterpreterAutoSelectionService } from '../types';
import { BaseRuleService, NextAction } from './baseRule';

@injectable()
export class CurrentPathInterpretersAutoSelectionRule extends BaseRuleService {
    constructor(
        @inject(IFileSystem) fs: IFileSystem,
        @inject(IInterpreterHelper) private readonly helper: IInterpreterHelper,
        @inject(IPersistentStateFactory) stateFactory: IPersistentStateFactory,
        @inject(IComponentAdapter) private readonly pyenvs: IComponentAdapter,
        @inject(IExperimentService) private readonly experimentService: IExperimentService,
        @inject(IServiceContainer) private readonly serviceContainer: IServiceContainer,
    ) {
        super(AutoSelectionRule.currentPath, fs, stateFactory);
    }

    protected async onAutoSelectInterpreter(
        resource: Resource,
        manager?: IInterpreterAutoSelectionService,
    ): Promise<NextAction> {
        const interpreters = (await inDiscoveryExperiment(this.experimentService))
            ? await this.pyenvs.getInterpreters(resource, undefined, [PythonEnvSource.PathEnvVar])
            : await this.serviceContainer
                  .get<IInterpreterLocatorService>(IInterpreterLocatorService, CURRENT_PATH_SERVICE)
                  .getInterpreters(resource);
        const bestInterpreter = this.helper.getBestInterpreter(interpreters);
        traceVerbose(
            `Selected Interpreter from ${this.ruleName}, ${
                bestInterpreter ? JSON.stringify(bestInterpreter) : 'Nothing Selected'
            }`,
        );
        return (await this.setGlobalInterpreter(bestInterpreter, manager)) ? NextAction.exit : NextAction.runNextRule;
    }
}
