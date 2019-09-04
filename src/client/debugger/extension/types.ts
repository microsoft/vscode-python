// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { CancellationToken, DebugAdapterDescriptorFactory, DebugConfigurationProvider, WorkspaceFolder } from 'vscode';
import { InputStep, MultiStepInput } from '../../common/utils/multiStepInput';
import { DebugConfigurationArguments } from '../types';

export const IDebugConfigurationService = Symbol('IDebugConfigurationService');
export interface IDebugConfigurationService extends DebugConfigurationProvider {}
export const IDebuggerBanner = Symbol('IDebuggerBanner');
export interface IDebuggerBanner {
    initialize(): void;
}

export const IDebugConfigurationProvider = Symbol('IDebugConfigurationProvider');
export type DebugConfigurationState = { config: Partial<DebugConfigurationArguments>; folder?: WorkspaceFolder; token?: CancellationToken };
export interface IDebugConfigurationProvider {
    buildConfiguration(input: MultiStepInput<DebugConfigurationState>, state: DebugConfigurationState): Promise<InputStep<DebugConfigurationState> | void>;
}

export enum DebugConfigurationType {
    default = 'default',
    launchFile = 'launchFile',
    remoteAttach = 'remoteAttach',
    launchDjango = 'launchDjango',
    launchFlask = 'launchFlask',
    launchModule = 'launchModule',
    launchPyramid = 'launchPyramid'
}

export enum PythonPathSource {
    launchJson = 'launch.json',
    settingsJson = 'settings.json'
}

export enum ExtensionSingleActivationServiceType {
    jsonCompletionProvider = 'jsonCompletionProvider',
    jsonUpdaterService = 'jsonUpdaterService',
    debugAdapterActivator = 'debugAdapterActivator'
}

export const IDebugAdapterDescriptorFactory = Symbol('IDebugAdapterDescriptorFactory');
export interface IDebugAdapterDescriptorFactory extends DebugAdapterDescriptorFactory {}
