// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { inDiscoveryExperiment } from '../../../common/experiments/helpers';
import { traceVerbose } from '../../../common/logger';
import { IFileSystem, IPlatformService } from '../../../common/platform/types';
import { IExperimentService, IPersistentStateFactory, Resource } from '../../../common/types';
import { OSType } from '../../../common/utils/platform';
import { PythonEnvironment } from '../../../pythonEnvironments/info';
import {
    IComponentAdapter,
    IInterpreterHelper,
    IInterpreterLocatorService,
    WINDOWS_REGISTRY_SERVICE,
} from '../../contracts';
import { AutoSelectionRule, IInterpreterAutoSelectionService } from '../types';
import { BaseRuleService, NextAction } from './baseRule';

@injectable()
export class WindowsRegistryInterpretersAutoSelectionRule extends BaseRuleService {
    constructor(
        @inject(IFileSystem) fs: IFileSystem,
        @inject(IInterpreterHelper) private readonly helper: IInterpreterHelper,
        @inject(IPersistentStateFactory) stateFactory: IPersistentStateFactory,
        @inject(IPlatformService) private readonly platform: IPlatformService,
        @inject(IInterpreterLocatorService)
        @named(WINDOWS_REGISTRY_SERVICE)
        private winRegInterpreterLocator: IInterpreterLocatorService,
        @inject(IComponentAdapter) private readonly pyenvs: IComponentAdapter,
        @inject(IExperimentService) private readonly experimentService: IExperimentService,
    ) {
        super(AutoSelectionRule.windowsRegistry, fs, stateFactory);
    }
    protected async onAutoSelectInterpreter(
        resource: Resource,
        manager?: IInterpreterAutoSelectionService,
    ): Promise<NextAction> {
        if (this.platform.osType !== OSType.Windows) {
            return NextAction.runNextRule;
        }
        let interpreters: PythonEnvironment[] | undefined = [];
        if (await inDiscoveryExperiment(this.experimentService)) {
            interpreters = await this.pyenvs.getWinRegInterpreters(resource);
        } else {
            interpreters = await this.winRegInterpreterLocator.getInterpreters(resource);
        }
        const bestInterpreter = this.helper.getBestInterpreter(interpreters);
        traceVerbose(
            `Selected Interpreter from ${this.ruleName}, ${
                bestInterpreter ? JSON.stringify(bestInterpreter) : 'Nothing Selected'
            }`,
        );
        return (await this.setGlobalInterpreter(bestInterpreter, manager)) ? NextAction.exit : NextAction.runNextRule;
    }
}
