// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject } from 'inversify';
import { Uri } from 'vscode';
import { IWorkspaceService } from '../../../../common/application/types';
import { traceDecorators } from '../../../../common/logger';
import { createDeferred } from '../../../../common/utils/async';
import {
    IInterpreterWatcher,
    IInterpreterWatcherRegistry,
    WORKSPACE_VIRTUAL_ENV_SERVICE
} from '../../../../interpreter/contracts';
import { IServiceContainer } from '../../../../ioc/types';

export class InterpreterWatcherBuilder {
    private readonly watchersByResource = new Map<string, Promise<IInterpreterWatcher>>();
    /**
     * Creates an instance of InterpreterWatcherBuilder.
     * Inject the DI container, as we need to get a new instance of IInterpreterWatcher to build it.
     * @param {IWorkspaceService} workspaceService
     * @param {IServiceContainer} serviceContainer
     * @memberof InterpreterWatcherBuilder
     */
    constructor(
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IServiceContainer) private readonly serviceContainer: IServiceContainer
    ) {}

    @traceDecorators.verbose('Build the workspace interpreter watcher')
    public async getWorkspaceVirtualEnvInterpreterWatcher(resource: Uri | undefined): Promise<IInterpreterWatcher> {
        const key = this.getResourceKey(resource);
        if (!this.watchersByResource.has(key)) {
            const deferred = createDeferred<IInterpreterWatcher>();
            this.watchersByResource.set(key, deferred.promise);
            const watcher = this.serviceContainer.get<IInterpreterWatcherRegistry>(
                IInterpreterWatcherRegistry,
                WORKSPACE_VIRTUAL_ENV_SERVICE
            );
            await watcher.register(resource);
            deferred.resolve(watcher);
        }
        return this.watchersByResource.get(key)!;
    }
    protected getResourceKey(resource: Uri | undefined): string {
        const workspaceFolder = resource ? this.workspaceService.getWorkspaceFolder(resource) : undefined;
        return workspaceFolder ? workspaceFolder.uri.fsPath : '';
    }
}
