// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Event, Uri } from 'vscode';
import { IExtensionSingleActivationService } from '../../activation/types';
import { IPersistentState, Resource } from '../../common/types';
import { PythonEnvironment } from '../../pythonEnvironments/info';

export const IInterpreterAutoSelectionProxyService = Symbol('IInterpreterAutoSelectionProxyService');
/**
 * Interface similar to IInterpreterAutoSelectionService, to avoid chickn n egg situation.
 * Do we get python path from config first or get auto selected interpreter first!?
 * However, the class that reads python Path, must first give preference to selected interpreter.
 * But all classes everywhere make use of python settings!
 * Solution - Use a proxy that does nothing first, but later the real instance is injected.
 *
 * @export
 * @interface IInterpreterAutoSelectionProxyService
 */
export interface IInterpreterAutoSelectionProxyService {
    readonly onDidChangeAutoSelectedInterpreter: Event<void>;
    getAutoSelectedInterpreter(resource: Resource): PythonEnvironment | undefined;
    registerInstance?(instance: IInterpreterAutoSelectionProxyService): void;
    setWorkspaceInterpreter(resource: Uri, interpreter: PythonEnvironment | undefined): Promise<void>;
}

export const IInterpreterAutoSelectionService = Symbol('IInterpreterAutoSelectionService');
export interface IInterpreterAutoSelectionService extends IInterpreterAutoSelectionProxyService {
    readonly onDidChangeAutoSelectedInterpreter: Event<void>;
    autoSelectInterpreter(resource: Resource): Promise<void>;
    getAutoSelectedInterpreter(resource: Resource): PythonEnvironment | undefined;
    setGlobalInterpreter(interpreter: PythonEnvironment | undefined): Promise<void>;
}

export enum AutoSelectionRule {
    all = 'all',
    currentPath = 'currentPath',
    workspaceVirtualEnvs = 'workspaceEnvs',
    settings = 'settings',
    cachedInterpreters = 'cachedInterpreters',
    systemWide = 'system',
    windowsRegistry = 'windowsRegistry',
}

export const IInterpreterAutoSelectionRule = Symbol('IInterpreterAutoSelectionRule');
export interface IInterpreterAutoSelectionRule {
    setNextRule(rule: IInterpreterAutoSelectionRule): void;
    autoSelectInterpreter(resource: Resource, manager?: IInterpreterAutoSelectionService): Promise<void>;
    getPreviouslyAutoSelectedInterpreter(resource: Resource): PythonEnvironment | undefined;
}

export const IInterpreterSecurityService = Symbol('IInterpreterSecurityService');
export interface IInterpreterSecurityService {
    readonly onDidChangeSafeInterpreters: Event<void>;
    evaluateAndRecordInterpreterSafety(interpreter: PythonEnvironment, resource: Resource): Promise<void>;
    isSafe(interpreter: PythonEnvironment, resource?: Resource): boolean | undefined;
}

export const IInterpreterSecurityStorage = Symbol('IInterpreterSecurityStorage');
export interface IInterpreterSecurityStorage extends IExtensionSingleActivationService {
    readonly unsafeInterpreterPromptEnabled: IPersistentState<boolean>;
    readonly unsafeInterpreters: IPersistentState<string[]>;
    readonly safeInterpreters: IPersistentState<string[]>;
    hasUserApprovedWorkspaceInterpreters(resource: Uri): IPersistentState<boolean | undefined>;
    storeKeyForWorkspace(resource: Uri): Promise<void>;
}

export const IInterpreterEvaluation = Symbol('IInterpreterEvaluation');
export interface IInterpreterEvaluation {
    evaluateIfInterpreterIsSafe(interpreter: PythonEnvironment, resource: Resource): Promise<boolean>;
    inferValueUsingCurrentState(interpreter: PythonEnvironment, resource: Resource): boolean | undefined;
}
