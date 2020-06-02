// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, unmanaged } from 'inversify';
import { compare } from 'semver';
import '../../../common/extensions';
import { traceDecorators, traceVerbose } from '../../../common/logger';
import { IFileSystem } from '../../../common/platform/types';
import { IPersistentState, IPersistentStateFactory, Resource } from '../../../common/types';
import { StopWatch } from '../../../common/utils/stopWatch';
import { PythonInterpreter } from '../../../pythonEnvironments/discovery/types';
import { sendTelemetryEvent } from '../../../telemetry';
import { EventName } from '../../../telemetry/constants';
import { AutoSelectionRule, IInterpreterAutoSelectionRule, IInterpreterAutoSelectionService } from '../types';

export enum NextAction {
    runNextRule = 'runNextRule',
    exit = 'exit'
}

@injectable()
export abstract class BaseRuleService implements IInterpreterAutoSelectionRule {
    protected nextRule?: IInterpreterAutoSelectionRule;
    private readonly stateStore: IPersistentState<PythonInterpreter | undefined>;
    constructor(
        @unmanaged() protected readonly ruleName: AutoSelectionRule,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(IPersistentStateFactory) stateFactory: IPersistentStateFactory
    ) {
        this.stateStore = stateFactory.createGlobalPersistentState<PythonInterpreter | undefined>(
            `InterpreterAutoSeletionRule-${this.ruleName}`,
            undefined
        );
    }
    public setNextRule(rule: IInterpreterAutoSelectionRule): void {
        this.nextRule = rule;
    }
    @traceDecorators.verbose('autoSelectInterpreter')
    public async autoSelectInterpreter(resource: Resource, manager?: IInterpreterAutoSelectionService): Promise<void> {
        await this.clearCachedInterpreterIfInvalid(resource);
        const stopWatch = new StopWatch();
        const action = await this.onAutoSelectInterpreter(resource, manager);
        traceVerbose(`Rule = ${this.ruleName}, result = ${action}`);
        const identified = action === NextAction.runNextRule;
        sendTelemetryEvent(
            EventName.PYTHON_INTERPRETER_AUTO_SELECTION,
            { elapsedTime: stopWatch.elapsedTime },
            { rule: this.ruleName, identified }
        );
        if (action === NextAction.runNextRule) {
            await this.next(resource, manager);
        }
    }
    public getPreviouslyAutoSelectedInterpreter(_resource: Resource): PythonInterpreter | undefined {
        const value = this.stateStore.value;
        traceVerbose(`Current value for rule ${this.ruleName} is ${value ? JSON.stringify(value) : 'nothing'}`);
        return value;
    }
    protected abstract onAutoSelectInterpreter(
        resource: Resource,
        manager?: IInterpreterAutoSelectionService
    ): Promise<NextAction>;
    @traceDecorators.verbose('setGlobalInterpreter')
    protected async setGlobalInterpreter(
        interpreter?: PythonInterpreter,
        manager?: IInterpreterAutoSelectionService
    ): Promise<boolean> {
        await this.cacheSelectedInterpreter(undefined, interpreter);
        if (!interpreter || !manager || !interpreter.version) {
            return false;
        }
        const preferredInterpreter = manager.getAutoSelectedInterpreter(undefined);
        const comparison =
            preferredInterpreter && preferredInterpreter.version
                ? compare(interpreter.version.raw, preferredInterpreter.version.raw)
                : 1;
        if (comparison > 0) {
            await manager.setGlobalInterpreter(interpreter);
            return true;
        }
        if (comparison === 0) {
            return true;
        }

        return false;
    }
    protected async clearCachedInterpreterIfInvalid(resource: Resource) {
        if (!this.stateStore.value || (await this.fs.fileExists(this.stateStore.value.path))) {
            return;
        }
        sendTelemetryEvent(
            EventName.PYTHON_INTERPRETER_AUTO_SELECTION,
            {},
            { rule: this.ruleName, interpreterMissing: true }
        );
        await this.cacheSelectedInterpreter(resource, undefined);
    }
    protected async cacheSelectedInterpreter(_resource: Resource, interpreter: PythonInterpreter | undefined) {
        const interpreterPath = interpreter ? interpreter.path : '';
        const interpreterPathInCache = this.stateStore.value ? this.stateStore.value.path : '';
        const updated = interpreterPath === interpreterPathInCache;
        sendTelemetryEvent(EventName.PYTHON_INTERPRETER_AUTO_SELECTION, {}, { rule: this.ruleName, updated });
        await this.stateStore.updateValue(interpreter);
    }
    protected async next(resource: Resource, manager?: IInterpreterAutoSelectionService): Promise<void> {
        traceVerbose(`Executing next rule from ${this.ruleName}`);
        return this.nextRule && manager ? this.nextRule.autoSelectInterpreter(resource, manager) : undefined;
    }
}
