// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IWorkspaceService } from '../../../common/application/types';
import { IFileSystem } from '../../../common/platform/types';
import { IPersistentStateFactory, Resource } from '../../../common/types';
import { AutoSelectionRule, IInterpreterAutoSelectionService } from '../types';
import { BaseRuleService, NextAction } from './baseRule';

@injectable()
export class SettingsInterpretersAutoSelectionRule extends BaseRuleService {
    constructor(
        @inject(IFileSystem) fs: IFileSystem,
        @inject(IPersistentStateFactory) stateFactory: IPersistentStateFactory,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService
    ) {
        super(AutoSelectionRule.settings, fs, stateFactory);
    }
    protected async onAutoSelectInterpreter(_resource: Resource, _manager?: IInterpreterAutoSelectionService): Promise<NextAction> {
        // tslint:disable-next-line:no-any
        const pythonConfig = this.workspaceService.getConfiguration('python', null as any)!;
        const pythonPathInConfig = pythonConfig.inspect<string>('pythonPath')!;
        // No need to store python paths defined in settings in our caches, they can be retrieved from the settings directly.
        return pythonPathInConfig.globalValue && pythonPathInConfig.globalValue !== 'python' ? NextAction.exit : NextAction.runNextRule;
    }
}
