// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { LoggingLevelSettingType } from './types';
import { WorkspaceService } from '../common/application/workspace';

/**
 * Uses Workspace service to query for `python.logging.level` setting and returns it.
 */
export function getLoggingLevel(): LoggingLevelSettingType | 'off' {
    const workspace = new WorkspaceService();
    return workspace.getConfiguration('python').get<LoggingLevelSettingType>('logging.level') ?? 'error';
}
