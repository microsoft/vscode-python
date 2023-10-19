/* eslint-disable no-case-declarations */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { _SCRIPTS_DIR } from '../../common/process/internal/scripts/constants';
import { TerminalShellType } from '../../common/terminal/types';

type DeactivateShellInfo = {
    /**
     * Full path to source deactivate script to copy.
     */
    source: string;
    /**
     * Full path to destination to copy deactivate script to.
     */
    destination: string;
    initScript: {
        /**
         * Display name of init script for the shell.
         */
        displayName: string;
        /**
         * Command to run in shell to output the full path to init script.
         */
        command: string;
        /**
         * Contents to add to init script.
         */
        contents: string;
    };
};

// eslint-disable-next-line global-require
const untildify: (value: string) => string = require('untildify');

export function getDeactivateShellInfo(shellType: TerminalShellType): DeactivateShellInfo | undefined {
    switch (shellType) {
        case TerminalShellType.bash:
            return buildInfo(
                'deactivate',
                {
                    displayName: '~/.bashrc',
                    path: '~/.bashrc',
                },
                `source {0}`,
            );
        case TerminalShellType.powershellCore:
        case TerminalShellType.powershell:
            return buildInfo(
                'deactivate.ps1',
                {
                    displayName: 'Powershell Profile',
                    path: '$Profile',
                },
                `& "{0}"`,
            );
        case TerminalShellType.zsh:
            return buildInfo(
                'deactivate',
                {
                    displayName: '~/.zshrc',
                    path: '~/.zshrc',
                },
                `source {0}`,
            );
        case TerminalShellType.fish:
            return buildInfo(
                'deactivate.fish',
                {
                    displayName: 'config.fish',
                    path: '$__fish_config_dir/config.fish',
                },
                `source {0}`,
            );
        case TerminalShellType.cshell:
            return buildInfo(
                'deactivate.csh',
                {
                    displayName: '~/.cshrc',
                    path: '~/.cshrc',
                },
                `source {0}`,
            );
        default:
            return undefined;
    }
}

function buildInfo(
    deactivate: string,
    initScript: {
        path: string;
        displayName: string;
    },
    scriptCommandFormat: string,
) {
    const scriptPath = path.join('~', '.vscode-python', deactivate);
    return {
        source: path.join(_SCRIPTS_DIR, deactivate),
        destination: untildify(scriptPath),
        initScript: {
            displayName: initScript.displayName,
            command: `echo ${initScript.path}`,
            contents: scriptCommandFormat.format(scriptPath),
        },
    };
}
