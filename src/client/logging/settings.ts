// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { WorkspaceService } from '../common/application/workspace';
import { LogLevel } from './levels';

type LoggingLevelSettingType = 'off' | 'error' | 'warn' | 'info' | 'debug';

/**
 * Uses Workspace service to query for `python.logging.level` setting and returns it.
 */
export function getLoggingLevel(): LogLevel | 'off' {
    const workspace = new WorkspaceService();
    const value = workspace.getConfiguration('python').get<LoggingLevelSettingType>('logging.level');
    return convertSettingTypeToLogLevel(value);
}

function convertSettingTypeToLogLevel(setting: LoggingLevelSettingType | undefined): LogLevel | 'off' {
    switch (setting) {
        case 'info': {
            return LogLevel.Info;
        }
        case 'warn': {
            return LogLevel.Warn;
        }
        case 'off': {
            return 'off';
        }
        case 'debug': {
            return LogLevel.Debug;
        }
        default: {
            return LogLevel.Error;
        }
    }
}
