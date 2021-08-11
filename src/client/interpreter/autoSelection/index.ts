// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { Event, EventEmitter, Uri } from 'vscode';
import { IWorkspaceService } from '../../common/application/types';
import { EnvironmentSorting } from '../../common/experiments/groups';
import '../../common/extensions';
import { IFileSystem } from '../../common/platform/types';
import { IExperimentService, IPersistentState, IPersistentStateFactory, Resource } from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import { compareSemVerLikeVersions } from '../../pythonEnvironments/base/info/pythonVersion';
import { PythonEnvironment } from '../../pythonEnvironments/info';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { EnvTypeHeuristic, getEnvTypeHeuristic } from '../configuration/environmentTypeComparer';
import { InterpreterComparisonType, IInterpreterComparer } from '../configuration/types';
import { IInterpreterHelper, IInterpreterService } from '../contracts';
import {
    AutoSelectionRule,
    IInterpreterAutoSelectionRule,
    IInterpreterAutoSelectionService,
    IInterpreterAutoSelectionProxyService,
} from './types';

const preferredGlobalInterpreter = 'preferredGlobalPyInterpreter';
const workspacePathNameForGlobalWorkspaces = '';

@injectable()
export class InterpreterAutoSelectionService implements IInterpreterAutoSelectionService {
    protected readonly autoSelectedWorkspacePromises = new Map<string, Deferred<void>>();

    private readonly didAutoSelectedInterpreterEmitter = new EventEmitter<void>();

    private readonly autoSelectedInterpreterByWorkspace = new Map<string, PythonEnvironment | undefined>();

    private globallyPreferredInterpreter: IPersistentState<
        PythonEnvironment | undefined
    > = this.stateFactory.createGlobalPersistentState<PythonEnvironment | undefined>(
        preferredGlobalInterpreter,
        undefined,
    );

    private readonly rules: IInterpreterAutoSelectionRule[] = [];

    constructor(
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IPersistentStateFactory) private readonly stateFactory: IPersistentStateFactory,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(IExperimentService) private readonly experimentService: IExperimentService,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IInterpreterComparer)
        @named(InterpreterComparisonType.EnvType)
        private readonly envTypeComparer: IInterpreterComparer,
        @inject(IInterpreterAutoSelectionRule)
        @named(AutoSelectionRule.systemWide)
        systemInterpreter: IInterpreterAutoSelectionRule,
        @inject(IInterpreterAutoSelectionRule)
        @named(AutoSelectionRule.currentPath)
        currentPathInterpreter: IInterpreterAutoSelectionRule,
        @inject(IInterpreterAutoSelectionRule)
        @named(AutoSelectionRule.windowsRegistry)
        winRegInterpreter: IInterpreterAutoSelectionRule,
        @inject(IInterpreterAutoSelectionRule)
        @named(AutoSelectionRule.cachedInterpreters)
        cachedPaths: IInterpreterAutoSelectionRule,
        @inject(IInterpreterAutoSelectionRule)
        @named(AutoSelectionRule.settings)
        private readonly userDefinedInterpreter: IInterpreterAutoSelectionRule,
        @inject(IInterpreterAutoSelectionRule)
        @named(AutoSelectionRule.workspaceVirtualEnvs)
        workspaceInterpreter: IInterpreterAutoSelectionRule,
        @inject(IInterpreterAutoSelectionProxyService) proxy: IInterpreterAutoSelectionProxyService,
        @inject(IInterpreterHelper) private readonly interpreterHelper: IInterpreterHelper,
    ) {
        // It is possible we area always opening the same workspace folder, but we still need to determine and cache
        // the best available interpreters based on other rules (cache for furture use).
        this.rules.push(
            ...[
                winRegInterpreter,
                currentPathInterpreter,
                systemInterpreter,
                cachedPaths,
                userDefinedInterpreter,
                workspaceInterpreter,
            ],
        );
        proxy.registerInstance!(this);
        // Rules are as follows in order
        // 1. First check user settings.json
        //      If we have user settings, then always use that, do not proceed.
        // 2. Check workspace virtual environments (pipenv, etc).
        //      If we have some, then use those as preferred workspace environments.
        // 3. Check list of cached interpreters (previously cachced from all the rules).
        //      If we find a good one, use that as preferred global env.
        //      Provided its better than what we have already cached as globally preffered interpreter (globallyPreferredInterpreter).
        // 4. Check current path.
        //      If we find a good one, use that as preferred global env.
        //      Provided its better than what we have already cached as globally preffered interpreter (globallyPreferredInterpreter).
        // 5. Check windows registry.
        //      If we find a good one, use that as preferred global env.
        //      Provided its better than what we have already cached as globally preffered interpreter (globallyPreferredInterpreter).
        // 6. Check the entire system.
        //      If we find a good one, use that as preferred global env.
        //      Provided its better than what we have already cached as globally preffered interpreter (globallyPreferredInterpreter).
        userDefinedInterpreter.setNextRule(workspaceInterpreter);
        workspaceInterpreter.setNextRule(cachedPaths);
        cachedPaths.setNextRule(currentPathInterpreter);
        currentPathInterpreter.setNextRule(winRegInterpreter);
        winRegInterpreter.setNextRule(systemInterpreter);
    }

    /**
     * If there's a cached auto-selected interpreter -> return it.
     * If not, check if we are in the env sorting experiment, and use the appropriate auto-selection logic.
     */
    @captureTelemetry(EventName.PYTHON_INTERPRETER_AUTO_SELECTION, { rule: AutoSelectionRule.all }, true)
    public async autoSelectInterpreter(resource: Resource): Promise<void> {
        const key = this.getWorkspacePathKey(resource);

        if (!this.autoSelectedWorkspacePromises.has(key)) {
            const deferred = createDeferred<void>();
            this.autoSelectedWorkspacePromises.set(key, deferred);

            await this.initializeStore(resource);
            await this.clearWorkspaceStoreIfInvalid(resource);

            if (await this.experimentService.inExperiment(EnvironmentSorting.experiment)) {
                await this.autoselectInterpreterWithLocators(resource);
            } else {
                await this.autoselectInterpreterWithRules(resource);
            }

            deferred.resolve();
        }

        return this.autoSelectedWorkspacePromises.get(key)!.promise;
    }

    public get onDidChangeAutoSelectedInterpreter(): Event<void> {
        return this.didAutoSelectedInterpreterEmitter.event;
    }

    public getAutoSelectedInterpreter(resource: Resource): PythonEnvironment | undefined {
        // Do not execute anycode other than fetching fromm a property.
        // This method gets invoked from settings class, and this class in turn uses classes that relies on settings.
        // I.e. we can end up in a recursive loop.
        const workspaceState = this.getWorkspaceState(resource);
        if (workspaceState && workspaceState.value) {
            return workspaceState.value;
        }

        const workspaceFolderPath = this.getWorkspacePathKey(resource);
        if (this.autoSelectedInterpreterByWorkspace.has(workspaceFolderPath)) {
            return this.autoSelectedInterpreterByWorkspace.get(workspaceFolderPath);
        }

        return this.globallyPreferredInterpreter.value;
    }

    public async setWorkspaceInterpreter(resource: Uri, interpreter: PythonEnvironment | undefined): Promise<void> {
        await this.storeAutoSelectedInterpreter(resource, interpreter);
    }

    public async setGlobalInterpreter(interpreter: PythonEnvironment): Promise<void> {
        await this.storeAutoSelectedInterpreter(undefined, interpreter);
    }

    protected async clearWorkspaceStoreIfInvalid(resource: Resource): Promise<void> {
        const stateStore = this.getWorkspaceState(resource);
        if (stateStore && stateStore.value && !(await this.fs.fileExists(stateStore.value.path))) {
            sendTelemetryEvent(EventName.PYTHON_INTERPRETER_AUTO_SELECTION, {}, { interpreterMissing: true });
            await stateStore.updateValue(undefined);
        }
    }

    protected async storeAutoSelectedInterpreter(
        resource: Resource,
        interpreter: PythonEnvironment | undefined,
    ): Promise<void> {
        const workspaceFolderPath = this.getWorkspacePathKey(resource);
        if (workspaceFolderPath === workspacePathNameForGlobalWorkspaces) {
            // Update store only if this version is better.
            if (
                this.globallyPreferredInterpreter.value &&
                this.globallyPreferredInterpreter.value.version &&
                interpreter &&
                interpreter.version &&
                compareSemVerLikeVersions(this.globallyPreferredInterpreter.value.version, interpreter.version) > 0
            ) {
                return;
            }

            // Don't pass in manager instance, as we don't want any updates to take place.
            await this.globallyPreferredInterpreter.updateValue(interpreter);
            this.autoSelectedInterpreterByWorkspace.set(workspaceFolderPath, interpreter);
        } else {
            const workspaceState = this.getWorkspaceState(resource);
            if (workspaceState && interpreter) {
                await workspaceState.updateValue(interpreter);
            }
            this.autoSelectedInterpreterByWorkspace.set(workspaceFolderPath, interpreter);
        }
    }

    protected async initializeStore(resource: Resource): Promise<void> {
        const workspaceFolderPath = this.getWorkspacePathKey(resource);
        // Since we're initializing for this resource,
        // Ensure any cached information for this workspace have been removed.
        this.autoSelectedInterpreterByWorkspace.delete(workspaceFolderPath);
        if (this.globallyPreferredInterpreter) {
            return;
        }
        await this.clearStoreIfFileIsInvalid();
    }

    private async clearStoreIfFileIsInvalid() {
        this.globallyPreferredInterpreter = this.stateFactory.createGlobalPersistentState<
            PythonEnvironment | undefined
        >(preferredGlobalInterpreter, undefined);
        if (
            this.globallyPreferredInterpreter.value &&
            !(await this.fs.fileExists(this.globallyPreferredInterpreter.value.path))
        ) {
            await this.globallyPreferredInterpreter.updateValue(undefined);
        }
    }

    private getWorkspacePathKey(resource: Resource): string {
        return this.workspaceService.getWorkspaceFolderIdentifier(resource, workspacePathNameForGlobalWorkspaces);
    }

    private getWorkspaceState(resource: Resource): undefined | IPersistentState<PythonEnvironment | undefined> {
        const workspaceUri = this.interpreterHelper.getActiveWorkspaceUri(resource);
        if (workspaceUri) {
            const key = `autoSelectedWorkspacePythonInterpreter-${workspaceUri.folderUri.fsPath}`;
            return this.stateFactory.createWorkspacePersistentState(key, undefined);
        }
        return undefined;
    }

    private getAutoSelectionInterpretersQueryState(resource: Resource): IPersistentState<boolean | undefined> {
        const workspaceUri = this.interpreterHelper.getActiveWorkspaceUri(resource);
        const key = `autoSelectionInterpretersQueried-${workspaceUri?.folderUri.fsPath || 'global'}`;

        return this.stateFactory.createWorkspacePersistentState(key, undefined);
    }

    private async autoselectInterpreterWithRules(resource: Resource): Promise<void> {
        await this.userDefinedInterpreter.autoSelectInterpreter(resource, this);

        this.didAutoSelectedInterpreterEmitter.fire();

        Promise.all(this.rules.map((item) => item.autoSelectInterpreter(resource))).ignoreErrors();
    }

    /**
     * Auto-selection logic:
     * 1. If there are cached interpreters (not the first session in this workspace)
     *      -> sort using the same logic as in the interpreter quickpick and return the first one;
     * 2. If not, we already fire all the locators, so wait for their response, sort the interpreters and return the first one.
     *
     * `getInterpreters` will check the cache first and return early if there are any cached interpreters,
     * and if not it will wait for locators to return.
     * As such, we can sort interpreters based on what it returns.
     */
    private async autoselectInterpreterWithLocators(resource: Resource): Promise<void> {
        // Do not perform a full interpreter search if we already have cached interpreters for this workspace.
        const queriedState = this.getAutoSelectionInterpretersQueryState(resource);
        const interpreters = await this.interpreterService.getInterpreters(resource, {
            ignoreCache: queriedState.value !== true,
        });
        const workspaceUri = this.interpreterHelper.getActiveWorkspaceUri(resource);

        // When auto-selecting an intepreter for a workspace, we either want to return a local one
        // or fallback on a globally-installed interpreter, and we don't want want to suggest a global environment
        // because we would have to add a way to match environments to a workspace.
        const filteredInterpreters = interpreters.filter(
            (i) => getEnvTypeHeuristic(i, workspaceUri?.folderUri.fsPath || '') !== EnvTypeHeuristic.Global,
        );

        filteredInterpreters.sort(this.envTypeComparer.compare.bind(this.envTypeComparer));

        if (workspaceUri) {
            this.setWorkspaceInterpreter(workspaceUri.folderUri, filteredInterpreters[0]);
        } else {
            this.setGlobalInterpreter(filteredInterpreters[0]);
        }

        queriedState.updateValue(true);

        this.didAutoSelectedInterpreterEmitter.fire();
    }
}
