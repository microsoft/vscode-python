// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Event, Uri } from 'vscode';
import { IExtensionSingleActivationService } from '../../activation/types';
import { Resource } from '../../common/types';
import { PythonInterpreter } from '../contracts';

export const IInterpreterAutoSeletionProxyService = Symbol('IInterpreterAutoSeletionProxyService');
/**
 * Interface similar to IInterpreterAutoSelectionService, to avoid chickn n egg situation.
 * Do we get python path from config first or get auto selected interpreter first!?
 * However, the class that reads python Path, must first give preference to selected interpreter.
 * But all classes everywhere make use of python settings!
 * Solution - Use a proxy that does nothing first, but later the real instance is injected.
 *
 * @export
 * @interface IInterpreterAutoSeletionProxyService
 */
export interface IInterpreterAutoSeletionProxyService {
    readonly onDidChangeAutoSelectedInterpreter: Event<void>;
    getAutoSelectedInterpreter(resource: Resource): PythonInterpreter | undefined;
    registerInstance?(instance: IInterpreterAutoSeletionProxyService): void;
    setWorkspaceInterpreter(resource: Uri, interpreter: PythonInterpreter | undefined): Promise<void>;
}

export const IInterpreterAutoSelectionService = Symbol('IInterpreterAutoSelectionService');
export interface IInterpreterAutoSelectionService extends IInterpreterAutoSeletionProxyService {
    readonly onDidChangeAutoSelectedInterpreter: Event<void>;
    autoSelectInterpreter(resource: Resource): Promise<void>;
    getAutoSelectedInterpreter(resource: Resource): PythonInterpreter | undefined;
    setGlobalInterpreter(interpreter: PythonInterpreter | undefined): Promise<void>;
}

export enum AutoSelectionRule {
    all = 'all',
    currentPath = 'currentPath',
    workspaceVirtualEnvs = 'workspaceEnvs',
    settings = 'settings',
    cachedInterpreters = 'cachedInterpreters',
    systemWide = 'system',
    windowsRegistry = 'windowsRegistry'
}

export const IInterpreterAutoSelectionRule = Symbol('IInterpreterAutoSelectionRule');
export interface IInterpreterAutoSelectionRule {
    setNextRule(rule: IInterpreterAutoSelectionRule): void;
    autoSelectInterpreter(resource: Resource, manager?: IInterpreterAutoSelectionService): Promise<void>;
    getPreviouslyAutoSelectedInterpreter(resource: Resource): PythonInterpreter | undefined;
}

export const IInterpreterSecurityService = Symbol('IInterpreterSecurityService');
export interface IInterpreterSecurityService {
    readonly onDidChangeSafeInterpreters: Event<void>;
    evaluateInterpreterSafety(interpreter: PythonInterpreter, resource: Resource): Promise<void>;
    isSafe(interpreter: PythonInterpreter, resource?: Resource): boolean | undefined;
}

export const IInterpreterSecurityCommands = Symbol('IInterpreterSecurityCommands');
export interface IInterpreterSecurityCommands extends IExtensionSingleActivationService {
    getKeyForWorkspace(resource: Uri): string;
}

export const IInterpreterEvaluation = Symbol('IInterpreterEvaluation');
export interface IInterpreterEvaluation {
    evaluateIfInterpreterIsSafe(interpreter: PythonInterpreter, resource: Resource): Promise<boolean>;
    inferValueUsingStorage(interpreter: PythonInterpreter, resource: Resource): boolean | undefined;
}
