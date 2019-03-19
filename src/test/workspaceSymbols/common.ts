// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ConfigurationTarget, Uri, workspace } from 'vscode';
import { PythonSettings } from '../../client/common/configSettings';

export async function enableDisableWorkspaceSymbols(resource: Uri, enabled: boolean, configTarget: ConfigurationTarget) {
    const settings = workspace.getConfiguration('python', resource);
    await settings.update('workspaceSymbols.enabled', enabled, configTarget);
    PythonSettings.dispose();
}
