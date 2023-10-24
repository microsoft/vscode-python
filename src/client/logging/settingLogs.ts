// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { l10n } from 'vscode';
import { traceError, traceInfo } from '.';
import { Commands, PVSC_EXTENSION_ID } from '../common/constants';
import { showErrorMessage } from '../common/vscodeApis/windowApis';
import { getConfiguration, getWorkspaceFolders } from '../common/vscodeApis/workspaceApis';

function logOnLegacyFormatterSetting(): boolean {
    let usesLegacyFormatter = false;
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
            usesLegacyFormatter = true;
            traceError('Formatting features have been moved to separate formatter extensions.');
            traceError('See here for more information: https://code.visualstudio.com/docs/python/formatting');
            traceError('Please install the formatter extension you prefer and set it as the default formatter.');
            traceError('For `autopep8` use: https://marketplace.visualstudio.com/items?itemName=ms-python.autopep8');
            traceError(
                'For `black` use: https://marketplace.visualstudio.com/items?itemName=ms-python.black-formatter',
            );
            traceError('For `yapf` use: https://marketplace.visualstudio.com/items?itemName=eeyore.yapf');
        }
    });
    return usesLegacyFormatter;
}

function logOnLegacyLinterSetting(): boolean {
    let usesLegacyLinter = false;
    getWorkspaceFolders()?.forEach(async (workspace) => {
        let config = getConfiguration('python', { uri: workspace.uri, languageId: 'python' });
        if (!config) {
            config = getConfiguration('python', workspace.uri);
            if (!config) {
                traceError('Unable to get editor configuration');
            }
        }

        const linters: string[] = [
            'pylint',
            'flake8',
            'mypy',
            'pydocstyle',
            'pylama',
            'pycodestyle',
            'bandit',
            'prospector',
        ];

        linters.forEach((linter) => {
            const linterEnabled = config.get<boolean>(`linting.${linter}Enabled`, false);
            if (linterEnabled) {
                usesLegacyLinter = true;
                traceError('Linting features have been moved to separate linter extensions.');
                traceError('See here for more information: https://code.visualstudio.com/docs/python/linting');
                if (linter === 'pylint' || linter === 'flake8') {
                    traceError(
                        `Please install "${linter}" extension: https://marketplace.visualstudio.com/items?itemName=ms-python.${linter}`,
                    );
                } else if (linter === 'mypy') {
                    traceError(
                        `Please install "${linter}" extension: https://marketplace.visualstudio.com/items?itemName=ms-python.mypy-type-checker`,
                    );
                } else if (['pydocstyle', 'pylama', 'pycodestyle', 'bandit'].includes(linter)) {
                    traceError(
                        `selected linter "${linter}" may be supported by extensions like "Ruff", which include several linter rules: https://marketplace.visualstudio.com/items?itemName=charliermarsh.ruff`,
                    );
                }
            }
        });
    });

    return usesLegacyLinter;
}

let _isShown = false;
async function notifyLegacySettings(): Promise<void> {
    if (_isShown) {
        return;
    }
    _isShown = true;
    showErrorMessage(
        l10n.t(
            `Formatting and linting features have been deprecated from the Python extension. Please install a linter or a formatter extension. [Open logs](command:${Commands.ViewOutput}) for more information.`,
        ),
    );
}

export function logAndNotifyOnLegacySettings(): void {
    const usesLegacyFormatter = logOnLegacyFormatterSetting();
    const usesLegacyLinter = logOnLegacyLinterSetting();

    if (usesLegacyFormatter || usesLegacyLinter) {
        setImmediate(() => notifyLegacySettings().ignoreErrors());
    }
}
