// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { DebugConfigurationType } from '../debugger/extension/types';
import { LinterId } from '../linters/types';
import { IEventNamePropertyMapping } from '../telemetry/index';
import { EventName } from './constants';

export type EditorLoadTelemetry = IEventNamePropertyMapping[EventName.EDITOR_LOAD];

export type LanguageServerErrorTelemetry = {
    error: string;
};

export type LanguageServePlatformSupported = {
    supported: boolean;
    failureType?: 'UnknownError';
};

export type LinterTrigger = 'auto' | 'save';

export type LintingTelemetry = IEventNamePropertyMapping[EventName.LINTING];

export type LinterSelectionTelemetry = {
    tool?: LinterId;
    enabled: boolean;
};

export type PythonInterpreterTelemetry = IEventNamePropertyMapping[EventName.PYTHON_INTERPRETER];
export type CodeExecutionTelemetry = IEventNamePropertyMapping[EventName.EXECUTION_CODE];
export type DebuggerTelemetry = IEventNamePropertyMapping[EventName.DEBUGGER];
export type DebuggerPerformanceTelemetry = {
    duration: number;
    action: 'stepIn' | 'stepOut' | 'continue' | 'next' | 'launch';
};
export type TestTool = 'nosetest' | 'pytest' | 'unittest';
export type TestRunTelemetry = IEventNamePropertyMapping[EventName.UNITTEST_RUN];
export type TestDiscoverytTelemetry = IEventNamePropertyMapping[EventName.UNITTEST_DISCOVER];
export type TestConfiguringTelemetry = IEventNamePropertyMapping[EventName.UNITTEST_CONFIGURING];
export type FeedbackTelemetry = {
    action: 'accepted' | 'dismissed' | 'doNotShowAgain';
};
export type SettingsTelemetry = {
    enabled: boolean;
};
export type DebuggerConfigurationPromtpsTelemetry = {
    configurationType: DebugConfigurationType;
    autoDetectedDjangoManagePyPath?: boolean;
    autoDetectedPyramidIniPath?: boolean;
    autoDetectedFlaskAppPyPath?: boolean;
    manuallyEnteredAValue?: boolean;
};
export type ImportNotebook = {
    scope: 'command';
};

export const IImportTracker = Symbol('IImportTracker');
export interface IImportTracker {
    activate(): Promise<void>;
}
