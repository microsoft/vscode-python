// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { Uri } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import { DeprecatePythonPath } from '../../../common/experiments/groups';
import { traceVerbose } from '../../../common/logger';
import { IFileSystem, IPlatformService } from '../../../common/platform/types';
import { IExperimentsManager, IInterpreterPathService, IPersistentStateFactory, Resource } from '../../../common/types';
import { createDeferredFromPromise } from '../../../common/utils/async';
import { OSType } from '../../../common/utils/platform';
import {
    IInterpreterHelper,
    IInterpreterLocatorService,
    PythonInterpreter,
    WORKSPACE_VIRTUAL_ENV_SERVICE
} from '../../contracts';
import { AutoSelectionRule, IInterpreterAutoSelectionService } from '../types';
import { BaseRuleService, NextAction } from './baseRule';

@injectable()
export class WorkspaceVirtualEnvInterpretersAutoSelectionRule extends BaseRuleService {
    constructor(
        @inject(IFileSystem) fs: IFileSystem,
        @inject(IInterpreterHelper) private readonly helper: IInterpreterHelper,
        @inject(IPersistentStateFactory) stateFactory: IPersistentStateFactory,
        @inject(IPlatformService) private readonly platform: IPlatformService,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IInterpreterLocatorService)
        @named(WORKSPACE_VIRTUAL_ENV_SERVICE)
        private readonly workspaceVirtualEnvInterpreterLocator: IInterpreterLocatorService,
        @inject(IExperimentsManager) private readonly experiments: IExperimentsManager,
        @inject(IInterpreterPathService) private readonly interpreterPathService: IInterpreterPathService
    ) {
        super(AutoSelectionRule.workspaceVirtualEnvs, fs, stateFactory);
    }
    protected async onAutoSelectInterpreter(
        resource: Resource,
        manager?: IInterpreterAutoSelectionService
    ): Promise<NextAction> {
        const workspacePath = this.helper.getActiveWorkspaceUri(resource);
        if (!workspacePath) {
            return NextAction.runNextRule;
        }

        const pythonConfig = this.workspaceService.getConfiguration('python', workspacePath.folderUri)!;
        const pythonPathInConfig = this.experiments.inExperiment(DeprecatePythonPath.experiment)
            ? this.interpreterPathService.inspect(workspacePath.folderUri)
            : pythonConfig.inspect<string>('pythonPath')!;
        this.experiments.sendTelemetryIfInExperiment(DeprecatePythonPath.control);
        // If user has defined custom values in settings for this workspace folder, then use that.
        if (pythonPathInConfig.workspaceFolderValue || pythonPathInConfig.workspaceValue) {
            return NextAction.runNextRule;
        }
        const virtualEnvPromise = createDeferredFromPromise(
            this.getWorkspaceVirtualEnvInterpreters(workspacePath.folderUri)
        );

        const interpreters = await virtualEnvPromise.promise;
        const bestInterpreter =
            Array.isArray(interpreters) && interpreters.length > 0
                ? this.helper.getBestInterpreter(interpreters)
                : undefined;

        if (bestInterpreter && manager) {
            await super.cacheSelectedInterpreter(workspacePath.folderUri, bestInterpreter);
            await manager.setWorkspaceInterpreter(workspacePath.folderUri!, bestInterpreter);
        }

        traceVerbose(
            `Selected Interpreter from ${this.ruleName}, ${
                bestInterpreter ? JSON.stringify(bestInterpreter) : 'Nothing Selected'
            }`
        );
        return NextAction.runNextRule;
    }
    protected async getWorkspaceVirtualEnvInterpreters(resource: Resource): Promise<PythonInterpreter[] | undefined> {
        if (!resource) {
            return;
        }
        const workspaceFolder = this.workspaceService.getWorkspaceFolder(resource);
        if (!workspaceFolder) {
            return;
        }
        // Now check virtual environments under the workspace root
        const interpreters = await this.workspaceVirtualEnvInterpreterLocator.getInterpreters(resource, {
            ignoreCache: true
        });
        const workspacePath =
            this.platform.osType === OSType.Windows
                ? workspaceFolder.uri.fsPath.toUpperCase()
                : workspaceFolder.uri.fsPath;

        return interpreters.filter((interpreter) => {
            const fsPath = Uri.file(interpreter.path).fsPath;
            const fsPathToCompare = this.platform.osType === OSType.Windows ? fsPath.toUpperCase() : fsPath;
            return fsPathToCompare.startsWith(workspacePath);
        });
    }
}
