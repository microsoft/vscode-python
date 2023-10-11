// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { l10n } from 'vscode';
import { traceError, traceInfo } from '.';
import { Commands, PVSC_EXTENSION_ID } from '../common/constants';
import { showErrorMessage } from '../common/vscodeApis/windowApis';
import { getConfiguration, getWorkspaceFolders } from '../common/vscodeApis/workspaceApis';
import { Common } from '../common/utils/localize';
import { executeCommand } from '../common/vscodeApis/commandApis';

export function logAndNotifyOnFormatterSetting(): void {
    getWorkspaceFolders()?.forEach(async (workspace) => {
        let config = getConfiguration('editor', { uri: workspace.uri, languageId: 'python' });
        if (!config) {
            config = getConfiguration('editor', workspace.uri);
            if (!config) {
                traceError('Unable to get editor configuration');
            }
        }
        const formatter = config.get<string>('defaultFormatter', '');
        traceInfo(`Default formatter is set to ${formatter} for workspace ${workspace.uri.fsPath}`);
        if (formatter === PVSC_EXTENSION_ID) {
            traceError('Formatting features have been moved to separate formatter extensions.');
            traceError('Please install the formatter extension you prefer and set it as the default formatter.');
            traceError('For `autopep8` use: https://marketplace.visualstudio.com/items?itemName=ms-python.autopep8');
            traceError(
                'For `black` use: https://marketplace.visualstudio.com/items?itemName=ms-python.black-formatter',
            );
            traceError('For `yapf` use: https://marketplace.visualstudio.com/items?itemName=eeyore.yapf');
            const response = await showErrorMessage(
                l10n.t(
                    'Formatting features have been moved to separate formatter extensions. Please install the formatter extension you prefer and set it as the default formatter.',
                ),
                Common.showLogs,
            );
            if (response === Common.showLogs) {
                executeCommand(Commands.ViewOutput);
            }
        }
    });
}
