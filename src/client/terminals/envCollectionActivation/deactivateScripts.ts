/* eslint-disable no-case-declarations */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as paths from 'path';
import { _SCRIPTS_DIR } from '../../common/process/internal/scripts/constants';
import { TerminalShellType } from '../../common/terminal/types';

type InitScript = {
    /**
     * Display name of init script for the shell.
     */
    displayName: string;
    /**
     * Path to init script for the shell.
     */
    path: string;
};

type DeactivateShellInfo = {
    /**
     * Source deactivate script to copy.
     */
    source: string;
    /**
     * Destination to copy deactivate script to.
     */
    destination: string;
    initScript: InitScript & {
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
                    path: untildify('~/.bashrc'),
                },
                `source {0}`,
            );
        case TerminalShellType.powershell:
            return buildInfo(
                'deactivate.ps1',
                {
                    displayName: '$Profile',
                    path: untildify('$Profile'),
                },
                `& "{0}"`,
            );
        case TerminalShellType.zsh:
            return buildInfo(
                'deactivate',
                {
                    displayName: '~/.zshrc',
                    path: untildify('~/.zshrc'),
                },
                `source {0}`,
            );
        case TerminalShellType.fish:
            return buildInfo(
                'deactivate.fish',
                {
                    displayName: 'config.fish',
                    path: untildify('$__fish_config_dir/config.fish'),
                },
                `source {0}`,
            );
        case TerminalShellType.cshell:
            return buildInfo(
                'deactivate.csh',
                {
                    displayName: '~/.cshrc',
                    path: untildify('~/.cshrc'),
                },
                `source {0}`,
            );
        default:
            return undefined;
    }
}

function buildInfo(scriptName: string, initScript: InitScript, scriptCommandFormat: string) {
    const scriptPath = `~/.vscode-python/${scriptName}`;
    return {
        source: paths.join(_SCRIPTS_DIR, scriptName),
        destination: untildify(scriptPath),
        initScript: {
            ...initScript,
            contents: scriptCommandFormat.format(scriptPath),
        },
    };
}
