// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { DebugAdapterDescriptorFactory, DebugAdapterTrackerFactory, DebugConfigurationProvider } from 'vscode';

export const IDebugConfigurationService = Symbol('IDebugConfigurationService');
export interface IDebugConfigurationService extends DebugConfigurationProvider {}

export const IDebugAdapterDescriptorFactory = Symbol('IDebugAdapterDescriptorFactory');
export interface IDebugAdapterDescriptorFactory extends DebugAdapterDescriptorFactory {}

export const IDebugSessionLoggingFactory = Symbol('IDebugSessionLoggingFactory');

export interface IDebugSessionLoggingFactory extends DebugAdapterTrackerFactory {}

export const IOutdatedDebuggerPromptFactory = Symbol('IOutdatedDebuggerPromptFactory');

export interface IOutdatedDebuggerPromptFactory extends DebugAdapterTrackerFactory {}

/** Symbol identifier for the DataFrameTrackerFactory service */
export const IDataFrameTrackerFactory = Symbol('IDataFrameTrackerFactory');

/** 
 * Interface for debug adapter tracker factory that monitors dataframe variables
 * and suggests Jupyter extension installation when dataframes are detected.
 */
export interface IDataFrameTrackerFactory extends DebugAdapterTrackerFactory {}

export enum PythonPathSource {
    launchJson = 'launch.json',
    settingsJson = 'settings.json',
}
