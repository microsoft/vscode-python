// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IWorkspaceService } from '../../../common/application/types';
import { DeprecatePythonPath } from '../../../common/experiments/groups';
import { IFileSystem } from '../../../common/platform/types';
import { IExperimentsManager, IInterpreterPathService, IPersistentStateFactory, Resource } from '../../../common/types';
import { AutoSelectionRule, IInterpreterAutoSelectionService } from '../types';
import { BaseRuleService, NextAction } from './baseRule';

@injectable()
export class SettingsInterpretersAutoSelectionRule extends BaseRuleService {
    constructor(
        @inject(IFileSystem) fs: IFileSystem,
        @inject(IPersistentStateFactory) stateFactory: IPersistentStateFactory,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IExperimentsManager) private readonly experiments: IExperimentsManager,
        @inject(IInterpreterPathService) private readonly interpreterPathService: IInterpreterPathService,
    ) {
        super(AutoSelectionRule.settings, fs, stateFactory);
    }
    protected async onAutoSelectInterpreter(
        _resource: Resource,
        _manager?: IInterpreterAutoSelectionService,
    ): Promise<NextAction> {
        // tslint:disable-next-line:no-any
        const pythonConfig = this.workspaceService.getConfiguration('python', null as any)!;
        const pythonPathInConfig = this.experiments.inExperiment(DeprecatePythonPath.experiment)
            ? this.interpreterPathService.inspect(undefined)
            : pythonConfig.inspect<string>('pythonPath')!;
        this.experiments.sendTelemetryIfInExperiment(DeprecatePythonPath.control);
        // No need to store python paths defined in settings in our caches, they can be retrieved from the settings directly.
        return pythonPathInConfig.globalValue && pythonPathInConfig.globalValue !== 'python'
            ? NextAction.exit
            : NextAction.runNextRule;
    }
}
