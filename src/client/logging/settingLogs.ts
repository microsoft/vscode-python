// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { l10n } from 'vscode';
import { traceError, traceInfo } from '.';
import { Commands, PVSC_EXTENSION_ID } from '../common/constants';
import { showWarningMessage } from '../common/vscodeApis/windowApis';
import { getConfiguration, getWorkspaceFolders } from '../common/vscodeApis/workspaceApis';
import { Common } from '../common/utils/localize';
import { executeCommand } from '../common/vscodeApis/commandApis';

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
            traceError(
                'The setting "editor.defaultFormatter" for Python is set to "ms-python.python" which is deprecated.',
            );
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
                traceError(`Following setting is deprecated: "python.linting.${linter}Enabled"`);
                traceError(
                    `All settings starting with "python.linting." are deprecated and can be removed from settings.`,
                );
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
                        `Selected linter "${linter}" may be supported by extensions like "Ruff", which include several linter rules: https://marketplace.visualstudio.com/items?itemName=charliermarsh.ruff`,
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
    const response = await showWarningMessage(
        l10n.t(
            `You have deprecated linting or formatting settings for Python. Please see the [logs](command:${Commands.ViewOutput}) for more details.`,
        ),
        Common.learnMore,
    );
    if (response === Common.learnMore) {
        executeCommand('vscode.open', 'https://aka.ms/AAlgvkb');
    }
}

export function logAndNotifyOnLegacySettings(): void {
    const usesLegacyFormatter = logOnLegacyFormatterSetting();
    const usesLegacyLinter = logOnLegacyLinterSetting();

    if (usesLegacyFormatter || usesLegacyLinter) {
        setImmediate(() => notifyLegacySettings().ignoreErrors());
    }
}
