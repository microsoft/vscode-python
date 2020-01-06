// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { CancellationToken, DebugAdapterDescriptorFactory, DebugAdapterTrackerFactory, DebugConfigurationProvider, WorkspaceFolder } from 'vscode';
import { InputStep, MultiStepInput } from '../../common/utils/multiStepInput';
import { RemoteDebugOptions } from '../debugAdapter/types';
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
    launchPyramid = 'launchPyramid',
    pidAttach = 'pidAttach'
}

export enum PythonPathSource {
    launchJson = 'launch.json',
    settingsJson = 'settings.json'
}

export const IDebugAdapterDescriptorFactory = Symbol('IDebugAdapterDescriptorFactory');
export interface IDebugAdapterDescriptorFactory extends DebugAdapterDescriptorFactory {
    useNewPtvsd(pythonPath: string): Promise<boolean>;
    getPtvsdPath(): string;
    getRemotePtvsdArgs(remoteDebugOptions: RemoteDebugOptions): string[];
}

export type DebugAdapterPtvsdPathInfo = { extensionVersion: string; ptvsdPath: string };

export const IDebugSessionLoggingFactory = Symbol('IDebugSessionLoggingFactory');

export interface IDebugSessionLoggingFactory extends DebugAdapterTrackerFactory {}
